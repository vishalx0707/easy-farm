const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const { cropImage } = await import('../src/lib/crop-images.ts');
  const examples = [
    ['Potato', 'potatoes-still-life.webp'], ['Fresh Potatoes', 'potatoes-still-life.webp'],
    ['Aloo', 'potatoes-still-life.webp'], ['Vine tomatoes', 'tomatoes-still-life.webp'],
    ['Field carrots', 'poster-10787015.jpg'], ['Red bell peppers', 'poster-5479114.jpg'],
    ['Ruby bell peppers 360', 'poster-5479114.jpg'], ['Red onion', 'onion.webp'],
    ['Eggplant', 'brinjal.webp'], ['Bhindi', 'okra.webp'], ['Lady fingers', 'okra.webp'],
    ['Green chillies', 'chilli.webp'], ['Cabbage', 'cabbage.webp'],
    ['Cauliflower', 'cauliflower.webp'], ['Cucumber', 'cucumber.webp'],
    ['Spinach leaves', 'spinach.webp'], ['Palak', 'spinach.webp'],
  ];
  for (const [crop, suffix] of examples) {
    const { src } = cropImage(crop);
    assert(src.endsWith(suffix), crop + ' must have matching produce');
    assert(fs.existsSync('.' + src), crop + ' image must exist');
  }
  for (const crop of ['Sweet potato', 'Potato leaves', 'Mixed vegetables', 'Tomato and onion', 'Beetroot', 'Radish', 'Bottle gourd', 'White onion', 'Red cabbage', 'Green bell peppers', 'Red chilli', 'Root vegetables', '', 'Some unknown crop']) {
    assert.equal(cropImage(crop).credit, 'Photo not supplied', crop + ' must never borrow an unrelated photo');
  }
  assert.notEqual(cropImage('Potato').src, cropImage('Carrot').src);
  console.log('PASS crop images: 17 known crop names/aliases, mixed and unknown crop fallbacks, distinct potato/carrot images and existing asset paths.');
})().catch(error => { console.error(error); process.exitCode = 1; });
