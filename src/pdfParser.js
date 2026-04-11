import { getDocument, GlobalWorkerOptions, Util } from 'pdfjs-dist/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

const HEADER_KEYWORDS = [
  'loc',
  'sku',
  'barcode',
  'ean',
  'item',
  'product',
  'description',
  'planogram',
  'pog',
  'page',
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/(\d{6,14})(?=\p{L})/gu, '$1 ')
    .replace(/(\p{L})(\d{6,14})/gu, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeHeader(line) {
  const lower = line.toLowerCase();
  return HEADER_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function isSkuToken(token) {
  return /^\d{6,14}$/.test(token);
}

function isLocToken(token) {
  return /^\d{1,4}$/.test(token);
}

function isMostlyNumeric(tokens) {
  if (!tokens.length) {
    return false;
  }

  const numericCount = tokens.filter((token) => /^[\d./%-]+$/.test(token)).length;
  return numericCount / tokens.length >= 0.7;
}

function cleanName(value) {
  return normalizeWhitespace(
    value.replace(/\b(?:EA|PCS|PC|UNIT|QTY|FACE|FACING|SHELF)\b/gi, '').trim(),
  );
}

function groupTextItemsIntoLines(items) {
  const sorted = items
    .filter((item) => normalizeWhitespace(item.str))
    .map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width || 0,
    }))
    .sort((left, right) => right.y - left.y || left.x - right.x);

  const lines = [];

  sorted.forEach((item) => {
    const lastLine = lines[lines.length - 1];

    if (!lastLine || Math.abs(lastLine.y - item.y) > 3) {
      lines.push({ y: item.y, items: [item] });
      return;
    }

    lastLine.items.push(item);
  });

  return lines
    .map((line) => {
      const tokens = line.items.sort((left, right) => left.x - right.x);
      let text = '';
      let previous = null;

      tokens.forEach((token) => {
        if (!previous) {
          text += token.str;
          previous = token;
          return;
        }

        const gap = token.x - (previous.x + previous.width);
        text += gap > 2 ? ` ${token.str}` : token.str;
        previous = token;
      });

      return normalizeWhitespace(text);
    })
    .filter(Boolean);
}

function appendContinuation(record, line) {
  if (!record || !line || looksLikeHeader(line)) {
    return record;
  }

  const tokens = line.split(' ');
  const skuIndex = tokens.findIndex(isSkuToken);
  const candidateName = cleanName(skuIndex >= 0 ? tokens.slice(skuIndex + 1).join(' ') : line);

  if (!record.sku && skuIndex >= 0) {
    record.sku = tokens[skuIndex];
  }

  if (candidateName && !isMostlyNumeric(candidateName.split(' '))) {
    record.name = cleanName([record.name, candidateName].filter(Boolean).join(' '));
  }

  return record;
}

function finalizeRecord(record, fallbackLocId) {
  if (!record) {
    return null;
  }

  const name = cleanName(record.name || '');

  if (!record.sku || !name) {
    return null;
  }

  return {
    locId: Number.isFinite(record.locId) && record.locId > 0 ? record.locId : fallbackLocId,
    sku: record.sku,
    name,
  };
}

function dedupeRecords(records) {
  const seen = new Set();

  return records.filter((record) => {
    const key = `${record.locId}|${record.sku}|${record.name}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function parseStructuredRows(lines) {
  const records = [];
  let current = null;
  let fallbackLocId = 1;

  lines.forEach((line) => {
    if (!line || looksLikeHeader(line)) {
      return;
    }

    const tokens = line.split(' ');

    if (!tokens.length || isMostlyNumeric(tokens)) {
      return;
    }

    const skuIndices = [];
    tokens.forEach((token, index) => {
      if (isSkuToken(token)) {
        skuIndices.push(index);
      }
    });

    if (skuIndices.length === 0) {
      current = appendContinuation(current, line);
      return;
    }

    skuIndices.forEach((skuIdx, arrayPosition) => {
      const nextRecord = finalizeRecord(current, fallbackLocId);
      if (nextRecord) {
        records.push(nextRecord);
        fallbackLocId = Math.max(fallbackLocId, nextRecord.locId + 1);
      }

      let foundLocId = null;
      const startBoundary = arrayPosition > 0 ? skuIndices[arrayPosition - 1] + 1 : 0;
      
      for (let i = skuIdx - 1; i >= Math.max(startBoundary, skuIdx - 3); i -= 1) {
        if (isLocToken(tokens[i])) {
          foundLocId = Number(tokens[i]);
          break;
        }
      }

      let nameEnd = tokens.length;
      if (arrayPosition < skuIndices.length - 1) {
        const nextSkuIdx = skuIndices[arrayPosition + 1];
        let nextHasLoc = -1;
        for (let i = nextSkuIdx - 1; i >= Math.max(skuIdx + 1, nextSkuIdx - 3); i -= 1) {
          if (isLocToken(tokens[i])) {
            nextHasLoc = i;
            break;
          }
        }
        nameEnd = nextHasLoc !== -1 ? nextHasLoc : nextSkuIdx;
      }

      const nameTokens = tokens.slice(skuIdx + 1, nameEnd);

      current = {
        locId: foundLocId,
        sku: tokens[skuIdx],
        name: cleanName(nameTokens.join(' ')),
      };
    });
  });

  const lastRecord = finalizeRecord(current, fallbackLocId);
  if (lastRecord) {
    records.push(lastRecord);
  }

  return dedupeRecords(records);
}

function parseSkuFallback(lines) {
  const records = [];
  let fallbackLocId = 1;

  lines.forEach((line) => {
    if (!line || looksLikeHeader(line)) {
      return;
    }

    const regex = /\b\d{6,14}\b/g;
    let match;
    const matches = [];
    while ((match = regex.exec(line)) !== null) {
      matches.push({ sku: match[0], index: match.index });
    }

    if (!matches.length) {
      return;
    }

    matches.forEach((m, idx) => {
      const nextIndex = idx < matches.length - 1 ? matches[idx + 1].index : line.length;
      const rawName = line.slice(m.index + m.sku.length, nextIndex);
      const name = cleanName(rawName);

      if (name) {
        records.push({
          locId: fallbackLocId,
          sku: m.sku,
          name,
        });
        fallbackLocId += 1;
      }
    });
  });

  return dedupeRecords(records);
}

function extractMarkerCandidates(items, viewport) {
  return items
    .map((item) => {
      const raw = normalizeWhitespace(item.str);

      if (!isLocToken(raw)) {
        return null;
      }

      const transformed = Util.transform(viewport.transform, item.transform);
      const estimatedHeight = Math.max(Math.abs(item.transform?.[3]) || item.height || 0, 8);
      const rect = viewport.convertToViewportRectangle([
        item.transform[4],
        item.transform[5],
        item.transform[4] + (item.width || estimatedHeight),
        item.transform[5] + estimatedHeight,
      ]);
      const minX = Math.min(rect[0], rect[2]);
      const maxX = Math.max(rect[0], rect[2]);
      const minY = Math.min(rect[1], rect[3]);
      const maxY = Math.max(rect[1], rect[3]);
      const fontSize = Math.max(10, Math.abs(maxY - minY), Math.abs(transformed[3]) || 0);
      const x = clamp((minX + maxX) / 2 / viewport.width, 0.02, 0.98);
      const y = clamp((minY + maxY) / 2 / viewport.height, 0.02, 0.98);

      return {
        locId: Number(raw),
        x,
        y,
        fontSize,
      };
    })
    .filter(Boolean);
}

function groupMarkersByLocId(candidates, validLocIds) {
  const groups = new Map();

  candidates.forEach((candidate) => {
    if (validLocIds && !validLocIds.has(candidate.locId)) {
      return;
    }

    const list = groups.get(candidate.locId) || [];
    list.push(candidate);
    groups.set(candidate.locId, list);
  });

  return groups;
}

function calculateSpread(markers) {
  if (markers.length < 2) {
    return { xSpread: 0, ySpread: 0 };
  }

  const xs = markers.map((marker) => marker.x);
  const ys = markers.map((marker) => marker.y);

  return {
    xSpread: Math.max(...xs) - Math.min(...xs),
    ySpread: Math.max(...ys) - Math.min(...ys),
  };
}

function scoreMarkerLayout(markers) {
  if (markers.length === 0) {
    return 0;
  }

  const { xSpread, ySpread } = calculateSpread(markers);
  const areaScore = xSpread * ySpread * 280;
  const spreadScore = xSpread * 90 + ySpread * 70;
  const countScore = markers.length * 2;
  const edgePenalty = markers.reduce((total, marker) => {
    const edgeDistance = Math.min(marker.x, 1 - marker.x, marker.y, 1 - marker.y);
    return total + (edgeDistance < 0.06 ? (0.06 - edgeDistance) * 30 : 0);
  }, 0);

  return areaScore + spreadScore + countScore - edgePenalty;
}

function optimizeMarkerSelection(candidates, validLocIds) {
  const grouped = groupMarkersByLocId(candidates, validLocIds);
  const locIds = Array.from(grouped.keys());

  if (locIds.length === 0) {
    return [];
  }

  const selected = new Map(
    locIds.map((locId) => {
      const group = grouped.get(locId) || [];
      const bestByFontSize = group.reduce((best, candidate) => {
        if (!best || candidate.fontSize > best.fontSize) {
          return candidate;
        }

        return best;
      }, null);

      return [locId, bestByFontSize];
    }),
  );

  let improved = true;
  let safety = 0;

  while (improved && safety < 6) {
    improved = false;
    safety += 1;

    locIds.forEach((locId) => {
      const group = grouped.get(locId) || [];

      if (group.length < 2) {
        return;
      }

      const baseline = Array.from(selected.values()).filter(Boolean);
      let bestCandidate = selected.get(locId);
      let bestScore = scoreMarkerLayout(baseline);

      group.forEach((candidate) => {
        const nextSelection = Array.from(selected.entries()).map(([entryLocId, entryCandidate]) =>
          entryLocId === locId ? candidate : entryCandidate,
        );
        const nextScore = scoreMarkerLayout(nextSelection.filter(Boolean));

        if (nextScore > bestScore) {
          bestScore = nextScore;
          bestCandidate = candidate;
        }
      });

      if (bestCandidate && bestCandidate !== selected.get(locId)) {
        selected.set(locId, bestCandidate);
        improved = true;
      }
    });
  }

  return Array.from(selected.values()).filter(Boolean);
}

function scorePage(snapshot, lineId, side, validLocIds) {
  const text = snapshot.fullText;
  const markers = optimizeMarkerSelection(snapshot.markerCandidates, validLocIds);
  const layoutScore = scoreMarkerLayout(markers);
  const lineKey = String(lineId || '').toLowerCase();
  const sideKey = String(side || '').toLowerCase();
  const headerHits = HEADER_KEYWORDS.filter((keyword) => text.includes(keyword)).length;
  const validMarkerCount = markers.length;
  const allNumberedMarkerCount = groupMarkersByLocId(snapshot.markerCandidates).size;
  const expectedMarkerCount = Math.max(validLocIds?.size || 0, 1);
  const coverage = validMarkerCount / expectedMarkerCount;

  let score = validMarkerCount * 120;
  score += coverage * 220;
  score += allNumberedMarkerCount * 18;
  score += layoutScore * 0.35;

  if (lineKey && text.includes(lineKey)) {
    score += 18;
  }

  if (lineKey && text.includes(`line ${lineKey}`)) {
    score += 8;
  }

  if (lineKey && sideKey && text.includes(`${lineKey}-${sideKey}`)) {
    score += 6;
  }

  if (
    sideKey &&
    [`side ${sideKey}`, `mat ${sideKey}`, `facing ${sideKey}`].some((pattern) => text.includes(pattern))
  ) {
    score += 8;
  }

  if (validMarkerCount === 0) {
    score -= 80;
  }

  if (allNumberedMarkerCount < 4) {
    score -= (4 - allNumberedMarkerCount) * 12;
  }

  score -= Math.max(0, headerHits - 1) * 2.5;

  return {
    pageNumber: snapshot.pageNumber,
    score,
    markers,
    validMarkerCount,
    allNumberedMarkerCount,
    coverage,
  };
}

function calculateMarkerBoundingBox(markers, padding = 0.08) {
  if (!markers || markers.length === 0) {
    return { x1: 0, y1: 0, x2: 1, y2: 1 };
  }

  let x1 = Math.min(...markers.map((m) => m.x));
  let y1 = Math.min(...markers.map((m) => m.y));
  let x2 = Math.max(...markers.map((m) => m.x));
  let y2 = Math.max(...markers.map((m) => m.y));

  // Expand with padding
  x1 = Math.max(0, x1 - padding * 0.7); // less horizontal padding usually
  y1 = Math.max(0, y1 - padding);
  x2 = Math.min(1, x2 + padding * 0.7);
  y2 = Math.min(1, y2 + padding);

  // If the box is too small, maybe something's wrong, return full page
  if (x2 - x1 < 0.1 || y2 - y1 < 0.1) {
    return { x1: 0, y1: 0, x2: 1, y2: 1 };
  }

  return { x1, y1, x2, y2 };
}

async function renderPageToCanvas(pdfDocument, pageNumber, scale = 1.3, cropBox = null) {
  const page = await pdfDocument.getPage(pageNumber);
  const fullViewport = page.getViewport({ scale });

  if (!cropBox) {
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(fullViewport.width);
    canvas.height = Math.ceil(fullViewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    await page.render({ canvasContext: context, viewport: fullViewport }).promise;
    return canvas;
  }

  // Calculate actual pixel coordinates for cropping
  const sx = cropBox.x1 * fullViewport.width;
  const sy = cropBox.y1 * fullViewport.height;
  const sw = (cropBox.x2 - cropBox.x1) * fullViewport.width;
  const sh = (cropBox.y2 - cropBox.y1) * fullViewport.height;

  const canvas = window.document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(sw));
  canvas.height = Math.max(1, Math.ceil(sh));
  const context = canvas.getContext('2d', { alpha: false });

  // Render full page to temporary canvas then crop
  const tempCanvas = window.document.createElement('canvas');
  tempCanvas.width = Math.ceil(fullViewport.width);
  tempCanvas.height = Math.ceil(fullViewport.height);
  const tempContext = tempCanvas.getContext('2d', { alpha: false });
  await page.render({ canvasContext: tempContext, viewport: fullViewport }).promise;

  context.drawImage(tempCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

async function renderStitchedVisual(pdfDocument, pageResults) {
  if (pageResults.length === 1) {
    const p = pageResults[0];
    const canvas = await renderPageToCanvas(pdfDocument, p.pageNumber, 1.3, p.cropBox);
    
    // Adjust markers for single cropped page
    const adjustedMarkers = p.markers.map(m => ({
      ...m,
      x: (m.x - p.cropBox.x1) / (p.cropBox.x2 - p.cropBox.x1),
      y: (m.y - p.cropBox.y1) / (p.cropBox.y2 - p.cropBox.y1),
    }));

    return {
      width: canvas.width,
      height: canvas.height,
      src: canvas.toDataURL('image/jpeg', 0.88),
      markers: adjustedMarkers,
    };
  }

  const canvases = await Promise.all(
    pageResults.map((p) => renderPageToCanvas(pdfDocument, p.pageNumber, 1.3, p.cropBox))
  );

  const totalWidth = canvases.reduce((sum, c) => sum + c.width, 0);
  const maxHeight = Math.max(...canvases.map((c) => c.height));

  const mainCanvas = window.document.createElement('canvas');
  mainCanvas.width = totalWidth;
  mainCanvas.height = maxHeight;
  const ctx = mainCanvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalWidth, maxHeight);

  const finalMarkers = [];
  let currentX = 0;

  canvases.forEach((canvas, idx) => {
    // Center vertically if heights differ
    const dy = (maxHeight - canvas.height) / 2;
    ctx.drawImage(canvas, currentX, dy);
    
    const p = pageResults[idx];
    const pageMarkers = p.markers;
    const cw = p.cropBox.x2 - p.cropBox.x1;
    const ch = p.cropBox.y2 - p.cropBox.y1;

    pageMarkers.forEach((m) => {
      // Local relative in crop box
      const localRx = (m.x - p.cropBox.x1) / cw;
      const localRy = (m.y - p.cropBox.y1) / ch;

      finalMarkers.push({
        ...m,
        x: (currentX + localRx * canvas.width) / totalWidth,
        y: (dy + localRy * canvas.height) / maxHeight,
      });
    });

    currentX += canvas.width;
  });

  return {
    width: totalWidth,
    height: maxHeight,
    src: mainCanvas.toDataURL('image/jpeg', 0.8),
    markers: finalMarkers,
  };
}


async function extractPlanogramVisual(pdfDocument, pageSnapshots, lineId, side, productLocIds) {
  const scoredPages = pageSnapshots
    .map((snapshot) => scorePage(snapshot, lineId, side, productLocIds))
    .filter((p) => p.validMarkerCount > 0 || p.allNumberedMarkerCount >= 5);

  if (scoredPages.length === 0) {
    return null;
  }

  const sortedPages = scoredPages.sort((a, b) => a.pageNumber - b.pageNumber);
  const distinctPages = [];
  let lastPg = -1;
  for (const p of sortedPages) {
    if (p.pageNumber !== lastPg) {
      distinctPages.push(p);
      lastPg = p.pageNumber;
    }
  }

  const pageResults = distinctPages.map((p) => ({
    pageNumber: p.pageNumber,
    cropBox: calculateMarkerBoundingBox(p.markers),
    markers: p.markers.map((marker) => ({
      locId: marker.locId,
      x: marker.x,
      y: marker.y,
      emphasis: clamp(marker.fontSize / 18, 0.9, 1.6),
    })),
  }));

  const merged = await renderStitchedVisual(pdfDocument, pageResults);

  return {
    ...merged,
    pageCount: pageResults.length,
    version: 2,
  };
}

export async function extractPlanogramFromPdf(file, options = {}) {
  const buffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: buffer });
  let pdfDocument = null;

  try {
    pdfDocument = await loadingTask.promise;
    const allLines = [];
    const pageSnapshots = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const lines = groupTextItemsIntoLines(textContent.items);

      allLines.push(...lines);
      pageSnapshots.push({
        pageNumber,
        fullText: lines.join(' ').toLowerCase(),
        markerCandidates: extractMarkerCandidates(textContent.items, viewport),
      });
    }

    if (allLines.length === 0) {
      throw new Error('PDF khong co text de phan tich. Neu day la file scan anh, can them OCR.');
    }

    const structuredProducts = parseStructuredRows(allLines);
    const products = structuredProducts.length > 0 ? structuredProducts : parseSkuFallback(allLines);

    if (products.length === 0) {
      throw new Error('Khong tach duoc SKU va ten san pham tu PDF nay.');
    }

    const productLocIds = new Set(products.map((product) => product.locId));
    const visual = await extractPlanogramVisual(
      pdfDocument,
      pageSnapshots,
      options.lineId,
      options.side,
      productLocIds,
    );

    return {
      products: products.sort((left, right) => right.locId - left.locId),
      visual,
    };
  } finally {
    if (pdfDocument) {
      try {
        pdfDocument.cleanup();
      } catch {}
    }

    loadingTask.destroy();
  }
}
