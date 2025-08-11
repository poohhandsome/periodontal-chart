export const slotConfigurations = {
  // Col 1 (Patient's Right)
  0: { teeth: ['18', '17', '16'], isVertical: false, label: 'R. Max. Molar PA' },
  1: { teeth: ['16', '15', '14'], isVertical: false, label: 'R. Max. Premolar PA' },
  2: { teeth: ['18', '48', '17', '47', '16', '46'], isVertical: true, label: 'R. Molar BW' },
  3: { teeth: ['16', '46', '15', '45', '14', '44'], isVertical: true, label: 'R. Premolar BW' },
  4: { teeth: ['48', '47', '46'], isVertical: false, label: 'R. Mand. Molar PA' },
  5: { teeth: ['46', '45', '44'], isVertical: false, label: 'R. Mand. Premolar PA' },

  // Col 2 (Anteriors)
  6: { teeth: ['13'], isVertical: true, label: 'R. Max. Canine PA' },
  7: { teeth: ['12', '11', '21', '22'], isVertical: true, label: 'Max. Incisor PA' },
  8: { teeth: ['23'], isVertical: true, label: 'L. Max. Canine PA' },
  9: { teeth: ['43'], isVertical: true, label: 'R. Mand. Canine PA' },
  10: { teeth: ['42', '41', '31', '32'], isVertical: true, label: 'Mand. Incisor PA' },
  11: { teeth: ['33'], isVertical: true, label: 'L. Mand. Canine PA' },

  // Col 3 (Patient's Left) - Flipped from Col 1
  12: { teeth: ['24', '25', '26'], isVertical: false, label: 'L. Max. Premolar PA' },
  13: { teeth: ['26', '27', '28'], isVertical: false, label: 'L. Max. Molar PA' },
  14: { teeth: ['24', '34', '25', '35', '26', '36'], isVertical: true, label: 'L. Premolar BW' },
  15: { teeth: ['26', '36', '27', '37', '28', '38'], isVertical: true, label: 'L. Molar BW' },
  16: { teeth: ['34', '35', '36'], isVertical: false, label: 'L. Mand. Premolar PA' },
  17: { teeth: ['36', '37', '38'], isVertical: false, label: 'L. Mand. Molar PA' },
};
