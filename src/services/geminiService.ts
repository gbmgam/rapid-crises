import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function classifyEmergency(description: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this emergency description and classify it.
    Response must be JSON format with fields:
    - type: "medical", "fire", "harassment", "panic", "other"
    - severity: "low", "medium", "high", "critical"
    - mobility: "mobile", "immobile", "constrained"
    - summary: a short summary of the situation
    - actions: list of 3 suggested immediate actions for the user

    Description: ${description}`,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
}

export async function predictRisk(environmentalData: any) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Predict crisis risk based on environmental data: ${JSON.stringify(environmentalData)}.
    Return a risk score (0-100) and primary threat.`,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
}
