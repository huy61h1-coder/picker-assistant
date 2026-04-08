export const STORAGE_KEY = 'picker-assistant-aisle-products';
export const VISUAL_STORAGE_KEY = 'picker-assistant-aisle-visuals';

export const INITIAL_AISLE_PRODUCTS = {
  'L17-A': [],
  'L12-A': [
    {
      locId: 1,
      sku: '10531914',
      name: 'HC TAM TRAI LAM MAT ICECOLD 160X200GY',
      verified: true,
    },
    {
      locId: 5,
      sku: '10763049',
      name: 'HC GOI MOCHI PILLOW BE',
      verified: true,
    },
  ],
};

export const MAIN_AISLES = [
  { id: 'L18', name: 'HBC My pham', cat: 'HBC' },
  { id: 'L17', name: 'HBC Hair Care', cat: 'HBC' },
  { id: 'L16', name: 'HBC BodyCare', cat: 'HBC' },
  { id: 'L15', name: 'HL Gia dung', cat: 'HomeCoordy' },
  { id: 'L14', name: 'HL Nha bep', cat: 'HomeCoordy' },
  { id: 'L13', name: 'HC Noi that', cat: 'HomeCoordy' },
  { id: 'L12', name: 'HC Bed/Clean', cat: 'HomeCoordy' },
  { id: 'L11', name: 'TOPVALU Thuc pham', cat: 'TopValu' },
  { id: 'L10', name: 'Khuyen mai 1', cat: 'Food' },
  { id: 'L9', name: 'Khuyen mai 2', cat: 'Food' },
  { id: 'L8', name: 'Gia vi A chau', cat: 'Food' },
  { id: 'L7', name: 'Thuc pham tre em', cat: 'Food' },
  { id: 'L6', name: 'Sua bot', cat: 'Food' },
  { id: 'L5', name: 'Sua tuoi', cat: 'Food' },
  { id: 'L4', name: 'Banh quy', cat: 'Food' },
  { id: 'L3', name: 'Snack', cat: 'Food' },
  { id: 'L2', name: 'Keo', cat: 'Food' },
  { id: 'L1', name: 'Nong san', cat: 'Food' },
];

export const SECONDARY_AISLES = Array.from({ length: 18 }, (_, index) => {
  const num = 18 - index;

  return {
    id: `L'${num}`,
    name: num >= 16 ? 'Dong lanh' : 'Thuc pham kho',
    cat: num >= 16 ? 'Frozen' : 'Food',
  };
});
