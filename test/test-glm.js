import OpenAI from 'openai';
import 'dotenv/config'; 


const apiKey = process.env.GLM_API_KEY;
const baseURL = process.env.ILMU_BASE_URL || 'https://api.ilmu.ai/v1';

const glm = new OpenAI({ apiKey, baseURL });

async function testModel() {
  console.log('Testing connection to PM/Z.AI Model...');
  try {
    const response = await glm.chat.completions.create({
      model: process.env.GLM_MODEL || 'ilmu-glm-5.1', 
      messages: [{ role: 'user', content: 'Say hello and tell me you are working!' }],
      max_tokens: 50
    });
    
    console.log('\n✅ Success! The model responded:');
    console.log(response.choices[0].message.content);
  } catch (error) {
    console.error('\n❌ Error Failed to connect:');
    console.error(error.message);
  }
}

testModel();