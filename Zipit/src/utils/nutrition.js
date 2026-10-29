export const nutritionDB = {
  'milk': { energy: '42 kcal', protein: '3.4g', carbs: '4.8g', fat: '1.5g' },
  'bread': { energy: '265 kcal', protein: '9g', carbs: '49g', fat: '3.2g' },
  'chips': { energy: '536 kcal', protein: '7g', carbs: '53g', fat: '35g' },
  'lay': { energy: '536 kcal', protein: '7g', carbs: '53g', fat: '35g' },
  'coca-cola': { energy: '42 kcal', protein: '0g', carbs: '10.6g', fat: '0g' },
  'coke': { energy: '42 kcal', protein: '0g', carbs: '10.6g', fat: '0g' },
  'pepsi': { energy: '41 kcal', protein: '0g', carbs: '10.4g', fat: '0g' },
  'maggi': { energy: '402 kcal', protein: '8g', carbs: '58g', fat: '14.4g' },
  'egg': { energy: '155 kcal', protein: '13g', carbs: '1.1g', fat: '11g' },
  'butter': { energy: '717 kcal', protein: '0.9g', carbs: '0.1g', fat: '81g' },
  'paneer': { energy: '265 kcal', protein: '18g', carbs: '1.2g', fat: '20g' },
  'kurkure': { energy: '493 kcal', protein: '5.6g', carbs: '63g', fat: '24g' },
  'biscuit': { energy: '450 kcal', protein: '6g', carbs: '70g', fat: '15g' },
  'apple': { energy: '52 kcal', protein: '0.3g', carbs: '14g', fat: '0.2g' },
  'banana': { energy: '89 kcal', protein: '1.1g', carbs: '23g', fat: '0.3g' },
  'onion': { energy: '40 kcal', protein: '1.1g', carbs: '9g', fat: '0.1g' },
  'potato': { energy: '77 kcal', protein: '2g', carbs: '17g', fat: '0.1g' },
  'tomato': { energy: '18 kcal', protein: '0.9g', carbs: '3.9g', fat: '0.2g' },
  'rice': { energy: '130 kcal', protein: '2.7g', carbs: '28g', fat: '0.3g' },
  'dal': { energy: '343 kcal', protein: '24g', carbs: '60g', fat: '1.2g' },
  'sugar': { energy: '387 kcal', protein: '0g', carbs: '100g', fat: '0g' },
  'oil': { energy: '884 kcal', protein: '0g', carbs: '0g', fat: '100g' },
  'surf excel': { energy: 'N/A', protein: 'N/A', carbs: 'N/A', fat: 'N/A', note: 'Not for consumption' },
  'soap': { energy: 'N/A', protein: 'N/A', carbs: 'N/A', fat: 'N/A', note: 'Not for consumption' },
  'shampoo': { energy: 'N/A', protein: 'N/A', carbs: 'N/A', fat: 'N/A', note: 'Not for consumption' },
  'comfort': { energy: 'N/A', protein: 'N/A', carbs: 'N/A', fat: 'N/A', note: 'Not for consumption' },
  'water': { energy: '0 kcal', protein: '0g', carbs: '0g', fat: '0g' },
  'ice cream': { energy: '207 kcal', protein: '3.5g', carbs: '24g', fat: '11g' },
  'chocolate': { energy: '545 kcal', protein: '4.9g', carbs: '61g', fat: '31g' },
  'kitkat': { energy: '502 kcal', protein: '6.8g', carbs: '62g', fat: '25g' },
  'dairy milk': { energy: '530 kcal', protein: '7.3g', carbs: '57g', fat: '30g' },
  'bhujia': { energy: '568 kcal', protein: '14g', carbs: '44g', fat: '38g' }
};

const defaultNutrition = { energy: '120 kcal', protein: '2g', carbs: '25g', fat: '1g' };

export const getNutritionalInfo = (productName) => {
  const nameLower = productName.toLowerCase();
  
  for (const key in nutritionDB) {
    if (nameLower.includes(key)) {
      return nutritionDB[key];
    }
  }
  
  return defaultNutrition;
};
