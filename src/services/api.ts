// API configuration
const WEATHER_API_KEY = '86d1047f15dc3fefdffdac8d1ecc1a8f';
const GOOGLE_MAPS_API_KEY = 'AIzaSyCcgJ7KIthEoVg4ZDx5j-USTPvJin-07dY';

// Supabase Edge Function URL for secure API keys
const SUPABASE_URL = 'https://hjrgwzwxoiaeqwjueczd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqcmd3end4b2lhZXF3anVlY3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NDcxNjAsImV4cCI6MjA4NDAyMzE2MH0.uLp-9zdGVgZSfrzICu6J6c_J6bE5qpqjVCI1oOLDJfk';

// Types
export type ScannerMode = 'identify' | 'diagnose' | 'multiple';

export interface PlantOverviewItem {
  mainDescription: string;
  negative: string;
  about: Array<{
    title: string;
    list: string[];
  }>;
}

export interface PlantOverview {
  wateringNeeds: PlantOverviewItem;
  fertilizing: PlantOverviewItem;
  lightRequirement: PlantOverviewItem;
  humidity: PlantOverviewItem;
  temperatureRange: PlantOverviewItem;
  soilType: PlantOverviewItem;
  potDrainage: PlantOverviewItem;
  pruningNeeds: PlantOverviewItem;
}

export interface PlantCarePlanItem {
  repeat: string;
  customRepeat: {
    value: number;
    type: string;
  };
  time: string;
}

export interface PlantCarePlan {
  watering: PlantCarePlanItem;
  fertilize: PlantCarePlanItem;
  repotting: PlantCarePlanItem;
  pruning: PlantCarePlanItem;
  humidity: PlantCarePlanItem;
  soilcheck: PlantCarePlanItem;
}

export interface PlantDiseaseItem {
  image: string;
  title: string;
  description: string;
  negative: string;
  fix: string;
}

export interface PlantInformation {
  name: string;
  description: string;
  labels: string[];
  overview: PlantOverview;
  careplan: PlantCarePlan;
  images: string[];
  disease: PlantDiseaseItem[];
}

// Fetch API keys from Edge Function
const getApiKeys = async (): Promise<{ geminiApiKey: string; pexelsApiKey: string }> => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/scan-plant`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch API keys: ${response.status}`);
  }

  const data = await response.json();
  return {
    geminiApiKey: data.geminiApiKey,
    pexelsApiKey: data.pexelsApiKey,
  };
};

// Fetch images from Pexels API
const fetchPexelsImages = async (
  query: string,
  pexelsApiKey: string,
  perPage: number = 6
): Promise<string[]> => {
  try {
    const searchQuery = encodeURIComponent(`${query} plant`);
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${searchQuery}&per_page=${perPage}&orientation=portrait`,
      {
        headers: { Authorization: pexelsApiKey },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.photos && data.photos.length > 0) {
        return data.photos.map((photo: any) => photo.src.large);
      }
    }
  } catch (error) {
    console.error('Pexels API error:', error);
  }

  return ['https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&q=80'];
};

// Fetch disease image from Pexels
const fetchDiseaseImage = async (
  diseaseTitle: string,
  pexelsApiKey: string
): Promise<string> => {
  try {
    let searchTerm = diseaseTitle.toLowerCase();

    // Smart search term mapping
    if (searchTerm.includes('yellow')) {
      searchTerm = 'plant yellow leaves disease';
    } else if (searchTerm.includes('brown')) {
      searchTerm = 'plant brown tips leaves';
    } else if (searchTerm.includes('rot')) {
      searchTerm = 'plant root rot disease';
    } else if (searchTerm.includes('pest') || searchTerm.includes('mite') || 
               searchTerm.includes('aphid') || searchTerm.includes('bug')) {
      searchTerm = 'plant pest insect damage';
    } else if (searchTerm.includes('mold') || searchTerm.includes('fungus') || 
               searchTerm.includes('mildew')) {
      searchTerm = 'plant mold fungus disease';
    } else if (searchTerm.includes('wilt')) {
      searchTerm = 'plant wilting drooping';
    } else if (searchTerm.includes('spot')) {
      searchTerm = 'plant leaf spot disease';
    } else if (searchTerm.includes('curl')) {
      searchTerm = 'plant leaf curl disease';
    } else if (searchTerm.includes('black')) {
      searchTerm = 'plant black spot disease';
    } else {
      searchTerm = 'plant disease damage';
    }

    const images = await fetchPexelsImages(searchTerm, pexelsApiKey, 1);
    return images[0];
  } catch (error) {
    console.error('Pexels disease image error:', error);
    return 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&q=80';
  }
};

// OpenWeatherMap API
export const fetchWeather = async (
  lat: number,
  lon: number,
  units: 'metric' | 'imperial' = 'metric'
) => {
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=${units}`
    );
    
    if (!response.ok) {
      throw new Error('Weather fetch failed');
    }
    
    const data = await response.json();
    return {
      success: true,
      data: {
        temp: Math.round(data.main.temp),
        location: data.name,
        icon: data.weather[0]?.icon,
        description: data.weather[0]?.description,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
      },
    };
  } catch (error) {
    console.error('Weather API error:', error);
    return { success: false, error };
  }
};

// Google Geocoding API
export const fetchLocation = async (lat: number, lon: number) => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_MAPS_API_KEY}&language=en`
    );
    
    if (!response.ok) {
      throw new Error('Location fetch failed');
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const addressComponents = data.results[0].address_components;
      const city = addressComponents.find((c: any) => 
        c.types.includes('locality') || c.types.includes('administrative_area_level_1')
      );
      const country = addressComponents.find((c: any) => 
        c.types.includes('country')
      );
      
      return {
        success: true,
        data: {
          city: city?.long_name || 'Unknown',
          country: country?.long_name || 'Unknown',
          countryCode: country?.short_name || '',
        },
      };
    }
    
    return { success: false, error: 'No results found' };
  } catch (error) {
    console.error('Location API error:', error);
    return { success: false, error };
  }
};

// ✅ GEMINI API - Plant Identification (matches Flutter implementation exactly)
/** Locale for AI output (e.g. en, de, fr). Scanner uses app language. */
export const identifyPlant = async (
  imagesBase64: string | string[],
  mode: ScannerMode = 'identify',
  onError?: (error: string) => void,
  locale: string = 'en'
): Promise<{ success: boolean; data?: PlantInformation; error?: any }> => {
  try {
    // Convert single image to array
    const images = Array.isArray(imagesBase64) ? imagesBase64 : [imagesBase64];

    // Validate images
    if (images.length === 0) {
      const error = 'No images provided';
      if (onError) onError(error);
      throw new Error(error);
    }

    if (mode === 'identify' && images.length !== 1) {
      const error = 'Identify mode requires exactly 1 image';
      if (onError) onError(error);
      throw new Error(error);
    }

    if ((mode === 'diagnose' || mode === 'multiple') && images.length !== 3) {
      const error = 'Diagnose/Multiple mode requires exactly 3 images';
      if (onError) onError(error);
      throw new Error(error);
    }

    // Get API keys from Edge Function
    const { geminiApiKey, pexelsApiKey } = await getApiKeys();

    // Convert images to Gemini format
    const imageParts: Array<{ inline_data: { mime_type: string; data: string } }> = [];
    
    for (const imageBase64 of images) {
      // Remove data URL prefix if present
      let base64Data = imageBase64;
      let mimeType = 'image/jpeg';
      
      if (imageBase64.includes('data:')) {
        const match = imageBase64.match(/data:([^;]+);base64,(.+)/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }

      imageParts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data,
        },
      });
    }

    if (imageParts.length === 0) {
      const error = 'No valid images to process';
      if (onError) onError(error);
      throw new Error(error);
    }

    // Build prompt based on mode
    let promptText = '';
    
    if (mode === 'identify') {
      promptText = `Analyze this image carefully.

CRITICAL: First verify that this image contains a PLANT or FLOWER. If the image shows anything else (person, animal, object, food, etc.), respond with ONLY this JSON:
{
  "error": "not_a_plant",
  "message": "This image does not appear to contain a plant or flower. Please upload a clear photo of a plant."
}

If it IS a plant or flower, identify it and provide complete information.`;
    } else if (mode === 'diagnose') {
      promptText = `Analyze these 3 images carefully.

CRITICAL: First verify that ALL images contain the SAME PLANT or FLOWER. If any image shows something else or different plants, respond with ONLY this JSON:
{
  "error": "not_a_plant",
  "message": "Please ensure all images show the same plant from different angles."
}

If all images show the same plant, identify it and diagnose any issues.`;
    } else if (mode === 'multiple') {
      promptText = `Analyze these 3 images carefully.

CRITICAL: First verify that ALL images contain the SAME PLANT or FLOWER. If any image shows something else or different plants, respond with ONLY this JSON:
{
  "error": "not_a_plant",
  "message": "Please ensure all images show the same plant from different angles."
}

If all images show the same plant, provide complete identification and care information.`;
    }

    // Build content parts for Gemini
    const contentParts: any[] = [
      ...imageParts,
      {
        text: `${promptText}

Return ONLY valid JSON with this exact structure (no markdown, no explanation, no code blocks):

{
  "name": "Common name of the plant (e.g., Monstera)",
  "description": "Scientific name (e.g., Monstera Deliciosa)",
  "labels": ["🌿 Tropical", "🐾 Pet-toxic", "🌱 Easy Care", "💧 Moderate Water"],
  
  "overview": {
    "WateringNeeds": {
      "mainDescription": "💧 Every 7-10 days when top 2-3cm dry",
      "negative": "Detailed potential issues with overwatering (2-3 sentences)",
      "about": [
        {
          "title": "Clear instruction title (one sentence)",
          "list": ["Actionable tip 1", "Actionable tip 2", "Actionable tip 3"]
        },
        {
          "title": "Second instruction title",
          "list": ["Actionable tip 1", "Actionable tip 2", "Actionable tip 3"]
        }
      ]
    },
    "Fertilizing": {
      "mainDescription": "🌱 NPK 10-10-10 every 2-4 weeks (spring-summer)",
      "negative": "Over-fertilizing issues (2-3 sentences)",
      "about": [
        {"title": "Feeding schedule guidance", "list": ["Tip 1", "Tip 2", "Tip 3"]},
        {"title": "Fertilizer type guidance", "list": ["Tip 1", "Tip 2", "Tip 3"]}
      ]
    },
    "LightRequirement": {
      "mainDescription": "☀️ Bright indirect 4-6hrs daily",
      "negative": "Light issues (2-3 sentences)",
      "about": [
        {"title": "Optimal light conditions", "list": ["Tip 1", "Tip 2", "Tip 3"]},
        {"title": "Adapting to home lighting", "list": ["Tip 1", "Tip 2", "Tip 3"]}
      ]
    },
    "Humidity": {
      "mainDescription": "💨 40-60% • Mist 2-3x weekly",
      "negative": "Low humidity issues (2-3 sentences)",
      "about": [
        {"title": "Humidity requirements", "list": ["Tip 1", "Tip 2", "Tip 3"]},
        {"title": "Increasing humidity", "list": ["Tip 1", "Tip 2", "Tip 3"]}
      ]
    },
    "TemperatureRange": {
      "mainDescription": "🌡️ 18-24°C (64-75°F) • Min 13°C (55°F)",
      "negative": "Temperature stress issues (2-3 sentences)",
      "about": [
        {"title": "Ideal temperature range", "list": ["Tip 1", "Tip 2", "Tip 3"]},
        {"title": "Temperature protection", "list": ["Tip 1", "Tip 2", "Tip 3"]}
      ]
    },
    "SoilType": {
      "mainDescription": "🪴 Well-draining mix • pH 6.0-7.0",
      "negative": "Wrong soil issues (2-3 sentences)",
      "about": [
        {"title": "Soil mix requirements", "list": ["Tip 1", "Tip 2", "Tip 3"]},
        {"title": "Matching soil to habitat", "list": ["Tip 1", "Tip 2", "Tip 3"]}
      ]
    },
    "PotDrainage": {
      "mainDescription": "⚫ Pot 15-25cm • Drainage holes required",
      "negative": "Poor drainage issues (2-3 sentences)",
      "about": [
        {"title": "Drainage hole requirements", "list": ["Tip 1", "Tip 2", "Tip 3"]},
        {"title": "Drainage layer setup", "list": ["Tip 1", "Tip 2", "Tip 3"]}
      ]
    },
    "PruningNeeds": {
      "mainDescription": "✂️ Remove dead leaves • Trim in spring",
      "negative": "Neglecting pruning issues (2-3 sentences)",
      "about": [
        {"title": "Regular pruning guidance", "list": ["Tip 1", "Tip 2", "Tip 3"]},
        {"title": "Proper pruning technique", "list": ["Tip 1", "Tip 2", "Tip 3"]}
      ]
    }
  },

  "careplan": {
    "Watering": {
      "Repeat": "Everyweek",
      "CustomRepeat": { "Value": 1, "Type": "week" },
      "Time": "09:00:00"
    },
    "Fertilize": {
      "Repeat": "Everymonth",
      "CustomRepeat": { "Value": 2, "Type": "month" },
      "Time": "10:00:00"
    },
    "Repotting": {
      "Repeat": "Custom",
      "CustomRepeat": { "Value": 1, "Type": "year" },
      "Time": "10:00:00"
    },
    "Pruning": {
      "Repeat": "Custom",
      "CustomRepeat": { "Value": 3, "Type": "month" },
      "Time": "10:00:00"
    },
    "Humidity": {
      "Repeat": "Everyday",
      "CustomRepeat": { "Value": 1, "Type": "day" },
      "Time": "08:00:00"
    },
    "Soilcheck": {
      "Repeat": "Everyweek",
      "CustomRepeat": { "Value": 2, "Type": "week" },
      "Time": "10:00:00"
    }
  },

  "disease": [
    {
      "image": "https://example.com/disease.jpg",
      "title": "Yellow Leaves",
      "description": "Detailed 2-3 sentence description",
      "nagitive": "Consequences if untreated (2-3 sentences)",
      "fix": "1. Step one\\n2. Step two\\n3. Step three\\n4. Step four\\n5. Step five"
    },
    {
      "image": "https://example.com/disease2.jpg",
      "title": "Brown Tips",
      "description": "Detailed description",
      "nagitive": "Consequences",
      "fix": "Numbered steps separated by \\\\n"
    },
    {
      "image": "https://example.com/disease3.jpg",
      "title": "Root Rot",
      "description": "Detailed description",
      "nagitive": "Consequences",
      "fix": "Numbered steps"
    },
    {
      "image": "https://example.com/disease4.jpg",
      "title": "Common Pests",
      "description": "Detailed description",
      "nagitive": "Consequences",
      "fix": "Numbered steps"
    }
  ]
}

IMPORTANT RULES FOR mainDescription:
- Keep it 1-2 lines maximum (under 50 characters total)
- Use emoji symbols: 💧 ☀️ 🌡️ 💨 🪴 ⚫ ✂️ 🌱
- Use concise measurements: cm, %, °C, °F, hrs
- Use bullet separator: •

OUTPUT LANGUAGE: Write ALL text fields (name, description, labels, overview, careplan, disease titles/descriptions/fix) in the language with code "${locale}". Use that language for every user-facing string (e.g. en=English, de=German, fr=French, es=Spanish, pt=Portuguese, ja=Japanese, ko=Korean, zh=Chinese, th=Thai, id=Indonesian).

CRITICAL: Provide EXACTLY 4 disease items with realistic, actionable information.`,
      },
    ];

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: contentParts }],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const error = `AI analysis failed: ${geminiResponse.status}`;
      if (onError) onError(error);
      throw new Error(error);
    }

    const geminiData = await geminiResponse.json();
    const candidates = geminiData.candidates;

    if (!candidates || candidates.length === 0) {
      const error = 'No AI response received';
      if (onError) onError(error);
      throw new Error(error);
    }

    const content = candidates[0].content;
    const parts = content.parts;

    if (!parts || parts.length === 0) {
      const error = 'Empty AI response';
      if (onError) onError(error);
      throw new Error(error);
    }

    let textResponse = parts[0].text as string;
    let cleanJson = textResponse.trim();

    // Clean markdown code blocks
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.substring(7);
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.substring(3);
    }

    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.substring(0, cleanJson.length - 3);
    }

    cleanJson = cleanJson.trim();

    // Parse JSON
    const plantData = JSON.parse(cleanJson);

    // Check if not a plant
    if (plantData.error) {
      const errorMessage = plantData.message;
      if (onError) onError(errorMessage);
      throw new Error(errorMessage);
    }

    // Validate required fields
    if (!plantData.name || !plantData.overview || !plantData.careplan || !plantData.disease) {
      const error = 'Invalid AI response format - missing required fields';
      if (onError) onError(error);
      throw new Error(error);
    }

    const plantName = plantData.name;

    // Fetch plant images from Pexels
    const imageUrls = await fetchPexelsImages(plantName, pexelsApiKey, 6);

    // Fetch disease images from Pexels
    const diseaseList: PlantDiseaseItem[] = [];
    for (const item of plantData.disease) {
      const diseaseImage = await fetchDiseaseImage(item.title, pexelsApiKey);
      diseaseList.push({
        image: diseaseImage,
        title: item.title,
        description: item.description,
        negative: item.nagitive || item.negative || '',
        fix: item.fix,
      });
    }

    // Build overview
    const overviewData = plantData.overview;
    const overview: PlantOverview = {
      wateringNeeds: buildPlantAbout(overviewData.WateringNeeds),
      fertilizing: buildPlantAbout(overviewData.Fertilizing),
      lightRequirement: buildPlantAbout(overviewData.LightRequirement),
      humidity: buildPlantAbout(overviewData.Humidity),
      temperatureRange: buildPlantAbout(overviewData.TemperatureRange),
      soilType: buildPlantAbout(overviewData.SoilType),
      potDrainage: buildPlantAbout(overviewData.PotDrainage),
      pruningNeeds: buildPlantAbout(overviewData.PruningNeeds),
    };

    // Build careplan
    const carePlanData = plantData.careplan;
    const careplan: PlantCarePlan = {
      watering: buildCarePlanItem(carePlanData.Watering),
      fertilize: buildCarePlanItem(carePlanData.Fertilize),
      repotting: buildCarePlanItem(carePlanData.Repotting),
      pruning: buildCarePlanItem(carePlanData.Pruning),
      humidity: buildCarePlanItem(carePlanData.Humidity),
      soilcheck: buildCarePlanItem(carePlanData.Soilcheck),
    };

    const result: PlantInformation = {
      name: plantName,
      description: plantData.description,
      labels: plantData.labels,
      overview,
      careplan,
      images: imageUrls,
      disease: diseaseList,
    };

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Plant identification error:', error);
    if (onError) onError(error.message || 'Unexpected error');
    return { success: false, error };
  }
};

// Helper function to build PlantAbout structure
const buildPlantAbout = (data: any): PlantOverviewItem => {
  return {
    mainDescription: data?.mainDescription || '',
    negative: data?.negative || '',
    about: (data?.about || []).map((item: any) => ({
      title: item.title || '',
      list: item.list || [],
    })),
  };
};

// Helper function to build CarePlanItem structure
const buildCarePlanItem = (data: any): PlantCarePlanItem => {
  return {
    repeat: data?.Repeat || 'Everyday',
    customRepeat: {
      value: data?.CustomRepeat?.Value || 1,
      type: data?.CustomRepeat?.Type || 'day',
    },
    time: data?.Time || '09:00:00',
  };
};

// ✅ GEMINI API - AI Chat assistant (Mr. Oliver)
export const sendChatMessage = async (
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  imageBase64?: string
): Promise<{ success: boolean; data?: { message: string }; error?: any }> => {
  try {
    // Get API keys from Edge Function
    const { geminiApiKey } = await getApiKeys();

    // Build conversation history
    const conversationParts: any[] = [];

    // Add system context — Chat: respond in the same language as the user's message
    conversationParts.push({
      text: `You are Mr. Oliver, an expert AI botanist assistant. 
You help users with plant care, identification, disease diagnosis, and gardening advice.
Be friendly, helpful, and provide accurate botanical information.
If the user shares an image, analyze it and provide relevant plant advice.
Keep responses concise but informative.

IMPORTANT: Always respond in the SAME language as the user's last message. If the user writes in Uzbek, respond in Uzbek; in English, respond in English; in Russian, respond in Russian; etc. Do not translate or switch language—match the user's language.`,
    });

    // Add previous messages as context
    for (const msg of messages.slice(0, -1)) {
      conversationParts.push({
        text: `${msg.role === 'user' ? 'User' : 'Mr. Oliver'}: ${msg.content}`,
      });
    }

    // Add current message
    const lastMessage = messages[messages.length - 1];
    
    if (imageBase64) {
      // Handle image message
      let base64Data = imageBase64;
      let mimeType = 'image/jpeg';
      
      if (imageBase64.includes('data:')) {
        const match = imageBase64.match(/data:([^;]+);base64,(.+)/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }

      conversationParts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data,
        },
      });
    }

    conversationParts.push({
      text: `User: ${lastMessage.content}

Please respond as Mr. Oliver:`,
    });

    // Call Gemini API
    const model = imageBase64 ? 'gemini-2.5-flash' : 'gemini-2.5-flash';
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: conversationParts }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`);
    }

    const data = await response.json();
    const candidates = data.candidates;

    if (!candidates || candidates.length === 0) {
      throw new Error('No AI response received');
    }

    let assistantMessage = candidates[0].content.parts[0].text as string;

    // Clean up response if it starts with "Mr. Oliver:"
    if (assistantMessage.startsWith('Mr. Oliver:')) {
      assistantMessage = assistantMessage.substring(11).trim();
    }

    return { success: true, data: { message: assistantMessage } };
  } catch (error) {
    console.error('Chat API error:', error);
    return { success: false, error };
  }
};
