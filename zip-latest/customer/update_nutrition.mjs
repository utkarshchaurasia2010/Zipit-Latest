import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bbaggauqnlcohrgvsios.supabase.co';
const supabaseAnonKey = 'sb_publishable_rCjAUoKGrW0u-CCnBb9rQw_ori9Y1dQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const updates = [
  { id: "6daf0f10-7d84-4748-bf0a-7a18340f046f", is_non_edible: false, nutrition_info: { energy: "1,450 kcal", protein: "0.5g", carbs: "360.0g", fat: "0.0g" } },
  { id: "386d5461-195d-46a3-9ff2-c01c44caaf55", is_non_edible: false, nutrition_info: { energy: "65 kcal", protein: "0.9g", carbs: "7.5g", fat: "3.5g" } },
  { id: "8673d431-cb34-422d-bc65-f7ea24c13e22", is_non_edible: false, nutrition_info: { energy: "200 kcal", protein: "1.5g", carbs: "28.0g", fat: "9.0g" } },
  { id: "1dd35b14-7f8c-425c-ae1b-b4747b9dd345", is_non_edible: true, specifications: "• Not for human consumption.\n• Keep away from children.\n• Use for laundry only." },
  { id: "30bb5881-3c55-445e-8fa3-fc90834b1c95", is_non_edible: false, nutrition_info: { energy: "0 kcal", protein: "0.0g", carbs: "0.0g", fat: "0.0g" } },
  { id: "0664ebf2-6339-4a7a-bbd9-8a56a07f9d4b", is_non_edible: false, nutrition_info: { energy: "6,750 kcal", protein: "0.0g", carbs: "0.0g", fat: "750.0g" } },
  { id: "7dc1b84d-005e-4413-a516-4ad4c7a576a8", is_non_edible: false, nutrition_info: { energy: "860 kcal", protein: "0.0g", carbs: "212.0g", fat: "0.0g" } },
  { id: "17100122-74d8-4d55-89d2-70d43c795b45", is_non_edible: true, specifications: "• Contains Paracetamol.\n• Follow medical advice before consumption.\n• Not for casual eating." },
  { id: "05d41124-45c1-4acd-9a21-8118a807f4a9", is_non_edible: false, nutrition_info: { energy: "220 kcal", protein: "0.0g", carbs: "55.0g", fat: "0.0g" } },
  { id: "d5fed026-cdf3-44b8-b822-276887d5d160", is_non_edible: false, nutrition_info: { energy: "40 kcal", protein: "2.0g", carbs: "9.0g", fat: "0.4g" } },
  { id: "7c628dd2-63b1-4de5-aac7-061ad1021ce8", is_non_edible: false, nutrition_info: { energy: "800 kcal", protein: "0.0g", carbs: "200.0g", fat: "0.0g" } },
  { id: "4df98056-9714-4c6a-9c42-da27c8e88030", is_non_edible: true, specifications: "• Bath soap.\n• For external use only.\n• Keep away from eyes." },
  { id: "6b5319dd-8ff8-4f16-b5e1-a00ff132e507", is_non_edible: false, nutrition_info: { energy: "18,400 kcal", protein: "600.0g", carbs: "3,800.0g", fat: "90.0g" } },
  { id: "da2719dc-91d8-4a6e-b9be-eee92a843d2c", is_non_edible: false, nutrition_info: { energy: "490 kcal", protein: "5.0g", carbs: "70.0g", fat: "21.0g" } },
  { id: "c3e0aa56-f308-4bbc-8d2e-c77639d2fafa", is_non_edible: false, nutrition_info: { energy: "980 kcal", protein: "8.5g", carbs: "238.0g", fat: "0.0g" } },
  { id: "8e4f86ea-45e0-4259-bbd5-d3e6596ec909", is_non_edible: false, nutrition_info: { energy: "770 kcal", protein: "20.0g", carbs: "170.0g", fat: "1.0g" } },
  { id: "9cac2f71-984c-4383-80d5-1c039a41444b", is_non_edible: false, nutrition_info: { energy: "110 kcal", protein: "19.0g", carbs: "9.0g", fat: "0.0g" } },
  { id: "89d13621-a278-4b23-ad67-96c361345a81", is_non_edible: false, nutrition_info: { energy: "2,800 kcal", protein: "40.0g", carbs: "560.0g", fat: "40.0g" } },
  { id: "1484ced5-cba3-43e5-a94e-52f448a57065", is_non_edible: false, nutrition_info: { energy: "1,040 kcal", protein: "32.0g", carbs: "200.0g", fat: "12.0g" } },
  { id: "55990cdf-5e61-4bd2-a915-d93176a3e6ce", is_non_edible: false, nutrition_info: { energy: "410 kcal", protein: "4.5g", carbs: "45.0g", fat: "24.0g" } },
  { id: "d899750f-159b-4278-bde0-0378a1c4b433", is_non_edible: true, specifications: "• Antiseptic liquid.\n• For external use only." },
  { id: "f8df3fe8-9e13-47de-be3d-8fd38f40a394", is_non_edible: false, nutrition_info: { energy: "400 kcal", protein: "11.0g", carbs: "93.0g", fat: "1.0g" } },
  { id: "e63ac33f-6f4e-40a2-ad74-908459c003c5", is_non_edible: false, nutrition_info: { energy: "17 kcal", protein: "1.5g", carbs: "2.7g", fat: "0.4g" } },
  { id: "d73ea2d7-6804-4f02-bcb1-a6c3b6f55f0c", is_non_edible: false, nutrition_info: { energy: "450 kcal", protein: "9.0g", carbs: "65.0g", fat: "16.0g" } },
  { id: "5489acc3-cdb2-42b8-98ee-8e24f5309448", is_non_edible: false, nutrition_info: { energy: "470 kcal", protein: "5.0g", carbs: "62.0g", fat: "22.0g" } },
  { id: "d2f89184-be60-480c-b07e-ab0bee07cfc3", is_non_edible: false, nutrition_info: { energy: "120 kcal", protein: "0.0g", carbs: "30.0g", fat: "0.0g" } },
  { id: "8e38df6e-ff20-4024-aba8-22a72cf5fd96", is_non_edible: false, nutrition_info: { energy: "2,300 kcal", protein: "0.0g", carbs: "580.0g", fat: "0.0g" } },
  { id: "dd4bc3ce-1ccb-43ec-b300-fd1a7b79596b", is_non_edible: false, nutrition_info: { energy: "10 kcal", protein: "1.8g", carbs: "0.8g", fat: "0.0g" } },
  { id: "815dc5a4-9166-4d3e-ac9f-d8e284880ef0", is_non_edible: false, nutrition_info: { energy: "190 kcal", protein: "2.5g", carbs: "23.0g", fat: "10.0g" } },
  { id: "8099caab-532d-4b32-aad3-7c7cfd7a0ba8", is_non_edible: false, nutrition_info: { energy: "980 kcal", protein: "15.0g", carbs: "140.0g", fat: "42.0g" } },
  { id: "8307bead-05ea-405a-a329-c2e746d707a2", is_non_edible: false, nutrition_info: { energy: "260 kcal", protein: "13.5g", carbs: "21.6g", fat: "13.5g" } },
  { id: "8213659d-ab2a-4061-b8fa-a8bc9c96e328", is_non_edible: false, nutrition_info: { energy: "135 kcal", protein: "1.8g", carbs: "13.5g", fat: "8.0g" } },
  { id: "098be248-ba7c-487e-bd59-9c75f425281c", is_non_edible: true, specifications: "• Hair oil.\n• Not for consumption." },
  { id: "f9ea5707-fd95-422c-8836-e5560d8c5597", is_non_edible: false, nutrition_info: { energy: "9,000 kcal", protein: "0.0g", carbs: "0.0g", fat: "1,000.0g" } },
  { id: "a6e5f951-0c4c-4a77-9cc5-84d8fb1c5eb9", is_non_edible: true, specifications: "• Fabric conditioner.\n• Toxic if swallowed.\n• Keep out of reach of children." }
];

async function updateProducts() {
  for (const p of updates) {
    const { id, ...data } = p;
    // ensure jsonb is correctly sent as an object or string
    const updateData = {
      is_non_edible: data.is_non_edible || false,
      specifications: data.specifications || null,
      nutrition_info: data.nutrition_info || null
    };

    const { error } = await supabase.from('products').update(updateData).eq('id', id);
    if (error) {
      console.error(`Failed to update ${id}:`, error);
    } else {
      console.log(`Updated ${id} successfully!`);
    }
  }
  console.log("All done!");
}

updateProducts();
