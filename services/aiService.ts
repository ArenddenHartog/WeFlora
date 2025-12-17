
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MatrixColumn, DiscoveredStructure, ContextItem, MatrixRow, Matrix, MatrixColumnType, Report, ProjectInsights } from '../types';

// Initialize the SDK
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// -- Helper: File to Base64 --
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// -- Helper: Robust JSON Parser --
const parseJSONSafely = (text: string) => {
    try {
        // Remove markdown code blocks if present
        const cleanText = text.replace(/```json\n?|```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON Parse Error", e);
        return {};
    }
};

export class AIService {
  
  constructor() {
    console.log(`WeFlora AI Service Initialized. Mode: Client-Side Gemini SDK`);
  }

  // --- Core Capabilities ---

  async generateTitle(content: string, type: 'report' | 'worksheet'): Promise<string> {
      try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a short, professional title (max 5 words) for a ${type} containing the following content: \n\n${content.substring(0, 500)}...`,
            config: {
                responseMimeType: 'text/plain',
            }
        });
        return response.text?.trim().replace(/^"|"$/g, '') || (type === 'report' ? 'New Report' : 'New Worksheet');
      } catch (e) {
          console.error("Title generation failed", e);
          return type === 'report' ? 'New Report' : 'New Worksheet';
      }
  }

  async refineText(text: string, instruction: string): Promise<string> {
      try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Original Text: "${text}"\n\nInstruction: ${instruction}\n\nReturn ONLY the refined text.`,
        });
        return response.text || text;
      } catch (e) {
          console.error("Refine text failed", e);
          return text; 
      }
  }

  async structureTextAsMatrix(text: string): Promise<{ columns: MatrixColumn[], rows: MatrixRow[] }> {
        try {
            const schema: Schema = {
                type: Type.OBJECT,
                properties: {
                    columns: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING, description: "Column header name" },
                                dataType: {
                                    type: Type.STRING,
                                    description: "Inferred data type. Use 'number' for numeric/currency/percentage, 'select' for categorical/enum data, 'text' for everything else.",
                                    enum: ["text", "number", "select"]
                                }
                            },
                            required: ["title", "dataType"]
                        },
                        description: "List of column definitions including inferred data types."
                    },
                    rows: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                values: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING },
                                    description: "List of cell values corresponding to the columns order."
                                }
                            }
                        }
                    }
                }
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Extract the data from the following text into a structured table format.
                
                CRITICAL INSTRUCTION: Infer the specific data type for each column based on the data patterns.
                - If values are numbers, currency, or percentages -> use 'number'.
                - If values are repeating categories (e.g. High/Med/Low, Species Types, Yes/No, Status) -> use 'select'.
                - Otherwise use 'text'.
                
                Text: \n\n${text}`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema
                }
            });

            const result = JSON.parse(response.text || "{}");
            
            const rawColumns = result.columns || []; // Array of {title, dataType}
            const rawRows = result.rows || [];

            if (rawColumns.length === 0) throw new Error("No columns found");

            // First pass: Extract values to arrays to help with processing
            const rowsData = rawRows.map((row: any) => row.values || []);

            const columns: MatrixColumn[] = rawColumns.map((colDef: any, i: number) => {
                let type: MatrixColumnType = 'text';
                if (colDef.dataType === 'number') type = 'number';
                if (colDef.dataType === 'select') type = 'select';

                const col: MatrixColumn = {
                    id: `col-${i}-${Date.now()}`,
                    title: colDef.title || `Column ${i + 1}`,
                    type: type,
                    width: i === 0 ? 250 : 150,
                    isPrimaryKey: i === 0
                };

                // Logic to populate options for 'select' columns based on extracted data
                if (type === 'select') {
                    const uniqueVals = new Set<string>();
                    rowsData.forEach((rowVals: string[]) => {
                        const val = rowVals[i];
                        if (val) uniqueVals.add(String(val).trim());
                    });
                    
                    // If reasonable cardinality, set options. Otherwise revert to text.
                    if (uniqueVals.size > 0 && uniqueVals.size <= 20) {
                        col.options = Array.from(uniqueVals).sort();
                    } else {
                        col.type = 'text';
                    }
                }

                return col;
            });

            const rows: MatrixRow[] = rowsData.map((values: string[], i: number) => {
                const cells: any = {};
                
                columns.forEach((col, colIdx) => {
                    let val = values[colIdx] || '';
                    cells[col.id] = { columnId: col.id, value: String(val) };
                });
                
                return {
                    id: `row-${i}-${Date.now()}`,
                    entityName: values[0] || `Item ${i}`,
                    cells
                };
            });

            return { columns, rows };

        } catch (e) {
            console.error("Structuring failed:", e);
            const colId = `col-note-${Date.now()}`;
            return {
                columns: [{ id: colId, title: 'Extracted Content', type: 'text', width: 400, isPrimaryKey: true }],
                rows: [{ id: `row-1`, entityName: 'Note', cells: { [colId]: { columnId: colId, value: text.substring(0, 500) } } }]
            };
        }
  }

  // Changed to Generator for Streaming
  async *generateChatStream(
      text: string, 
      files: File[] = [], 
      systemInstruction: string, 
      model: string = 'gemini-2.5-flash',
      contextItems: ContextItem[] = [],
      enableThinking: boolean = false
  ): AsyncGenerator<{ text?: string, grounding?: any }, void, unknown> {
      
      try {
        const parts: any[] = [];

        parts.push({ text: text });

        for (const file of files) {
            const base64Data = await fileToBase64(file);
            parts.push({
                inlineData: {
                    mimeType: file.type,
                    data: base64Data
                }
            });
        }

        // NEW: Inject internal asset content (Reports/Worksheets) directly into context
        if (contextItems.length > 0) {
             let contextFullText = "";
             contextItems.forEach(c => {
                 if (c.content) {
                     // Robust separator for internal context injection
                     contextFullText += `\n\n--- INTERNAL SOURCE START: ${c.name} (${c.source.toUpperCase()}) ---\n${c.content}\n--- INTERNAL SOURCE END ---\n`;
                 }
             });
             if (contextFullText) {
                 parts.push({ text: `\n\nThe following internal project data is provided for context:\n${contextFullText}` });
             }
        }

        const config: any = {
            systemInstruction: systemInstruction,
            tools: contextItems.some(i => i.source === 'web') ? [{ googleSearch: {} }] : undefined
        };

        if (enableThinking) {
            config.thinkingConfig = { thinkingBudget: 2048 }; 
        }

        const stream = await ai.models.generateContentStream({
            model: model,
            contents: { parts },
            config: config
        });

        for await (const chunk of stream) {
            yield { 
                text: chunk.text, 
                grounding: chunk.candidates?.[0]?.groundingMetadata 
            };
        }

      } catch (e) {
          console.error("Chat generation failed:", e);
          yield { 
              text: "⚠️ **Error**: Could not connect to Gemini API. Please check your API key and connection." 
          };
      }
  }

  // Kept for backward compat or single-shot tools
  async generateChatResponse(
      text: string, 
      files: File[] = [], 
      systemInstruction: string, 
      model: string = 'gemini-2.5-flash',
      contextItems: ContextItem[] = []
  ): Promise<{ text: string, grounding?: any }> {
      // Simple wrapper around stream for legacy calls
      let fullText = "";
      let lastGrounding = undefined;
      for await (const chunk of this.generateChatStream(text, files, systemInstruction, model, contextItems)) {
          if (chunk.text) fullText += chunk.text;
          if (chunk.grounding) lastGrounding = chunk.grounding;
      }
      return { text: fullText, grounding: lastGrounding };
  }

  async runAICell(prompt: string, contextFiles: File[] = [], globalContext?: string): Promise<string> {
       try {
           const parts: any[] = [];
           
           if (globalContext) {
               parts.push({ text: `Global Project Context:\n${globalContext}\n---\n` });
           }

           parts.push({ text: prompt });
           
           for (const file of contextFiles) {
                const base64Data = await fileToBase64(file);
                parts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: base64Data
                    }
                });
           }

           const response = await ai.models.generateContent({
               model: 'gemini-2.5-flash',
               contents: { parts }
           });
           
           return response.text?.trim() || "";
       } catch (e) {
           console.error("Skill execution failed", e);
           return "Error";
       }
  }

  async discoverStructures(files: File[]): Promise<DiscoveredStructure[]> {
      if (files.length === 0) return [];

      try {
        const file = files[0];
        const base64 = await fileToBase64(file);
        
        const schema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    suggestedColumns: { type: Type.ARRAY, items: { type: Type.STRING } },
                    confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                }
            }
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: file.type, data: base64 } },
                    { text: "Analyze this document. Identify distinct tables or lists that could be converted into a worksheet. Return a list of suggested structures." }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema
            }
        });

        return JSON.parse(response.text || "[]");
      } catch (e) {
          console.error("Discovery failed", e);
          return [];
      }
  }

  async analyzeDocuments(files: File[], extractionContext?: string, targetColumns?: MatrixColumn[]): Promise<{ columns: MatrixColumn[], rows: any[] }> {
      if (files.length === 0) return { columns: [], rows: [] };
      
      try {
        const file = files[0];
        const base64 = await fileToBase64(file);
        
        let responseSchema: Schema | undefined;
        
        if (targetColumns && targetColumns.length > 0) {
             const properties: any = {};
             targetColumns.forEach(col => {
                 properties[col.id] = { type: Type.STRING, description: col.title };
             });
             
             responseSchema = {
                 type: Type.OBJECT,
                 properties: {
                     rows: {
                         type: Type.ARRAY,
                         items: {
                             type: Type.OBJECT,
                             properties: properties
                         }
                     }
                 }
             };
        }

        const prompt = `
            Extract data from this document.
            Context: ${extractionContext || 'General data extraction'}
            ${targetColumns ? `Map data strictly to these columns: ${targetColumns.map(c => c.title).join(', ')}` : ''}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: file.type, data: base64 } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema
            }
        });
        
        const result = JSON.parse(response.text || "{}");
        const rawRows = result.rows || [];
        
        const rows = rawRows.map((r: any, i: number) => ({
            id: `row-${i}-${Date.now()}`,
            entityName: targetColumns ? r[targetColumns[0].id] : (Object.values(r)[0] as string),
            cells: Object.keys(r).reduce((acc: any, key) => {
                acc[key] = { columnId: key, value: String(r[key]) };
                return acc;
            }, {})
        }));

        return { columns: targetColumns || [], rows };

      } catch (e) {
          console.error("Extraction failed", e);
          return { columns: [], rows: [] };
      }
  }

  async generateReportContent(
      dataContext: string, 
      mode: 'narrative' | 'list' | 'comparison', 
      userPrompt: string
  ): Promise<string> {
      try {
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `
                Data Context: ${dataContext}
                
                Task: Generate a ${mode} based on the data above.
                User Instruction: ${userPrompt}
              `
          });
          return response.text || "";
      } catch (e) {
          console.error("Report generation failed", e);
          return "Error generating report content.";
      }
  }

  async getSpeciesProfile(speciesName: string): Promise<{ data: any, sources: any[] }> {
      try {
          // Use Google Search Grounding for real-time, accurate data
          // Schema is removed because Search tool + JSON schema is incompatible in strict mode
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash', // Flash supports grounding efficiently
              contents: `
                Research the tree species "${speciesName}" using Google Search.
                Return a valid JSON object describing it. 
                Do NOT use markdown code blocks (e.g. \`\`\`json). Just return the raw JSON string.
                
                JSON Structure:
                {
                  "scientificName": "string",
                  "commonName": "string",
                  "family": "string",
                  "isNative": boolean,
                  "height": "string (e.g. 15-20m)",
                  "spread": "string (e.g. 8-10m)",
                  "soilPreference": "string",
                  "sunExposure": "string",
                  "waterNeeds": "string",
                  "hardinessZone": "string",
                  "risks": ["string"],
                  "designUses": ["string"],
                  "alternatives": ["string"],
                  "insight": "string (a brief 2-sentence summary)"
                }
              `,
              config: {
                  tools: [{ googleSearch: {} }],
              }
          });
          
          const text = response.text || "{}";
          const data = parseJSONSafely(text);
          const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

          return { data, sources };

      } catch (e) {
          console.error("Species profile generation failed", e);
          return { data: null, sources: [] };
      }
  }

  async generateProjectInsights(matrices: Matrix[], reports: Report[]): Promise<ProjectInsights> {
        try {
            // Aggregate simplified context
            const worksheetSummaries = matrices.map(m => `Worksheet: "${m.title}" (${m.rows.length} rows). Columns: ${m.columns.map(c => c.title).join(', ')}.`).join('\n');
            const reportSummaries = reports.map(r => `Report: "${r.title}" (Last updated: ${r.lastModified}).`).join('\n');
            
            const context = `
            Project Data Overview:
            ${worksheetSummaries}
            ${reportSummaries}
            
            Instruction:
            Analyze this project structure and content.
            1. Generate a 50-word executive summary of the project status.
            2. Extract 3 key metrics (e.g. Total Species, Worksheets count, etc).
            3. Suggest 3 actionable next steps or missing data points.
            `;

            const schema: Schema = {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    metrics: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                label: { type: Type.STRING },
                                value: { type: Type.STRING },
                                icon: { type: Type.STRING, enum: ['chart', 'tree', 'alert', 'check'] }
                            }
                        }
                    },
                    actions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                type: { type: Type.STRING, enum: ['missing_data', 'suggestion'] }
                            }
                        }
                    }
                }
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: context,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema
                }
            });

            const data = JSON.parse(response.text || "{}");
            return {
                summary: data.summary || "No insights available.",
                metrics: data.metrics || [],
                actions: data.actions || [],
                updatedAt: new Date().toISOString()
            };

        } catch (e) {
            console.error("Insights generation failed", e);
            return {
                summary: "Could not generate insights.",
                metrics: [],
                actions: [],
                updatedAt: new Date().toISOString()
            };
        }
  }
}

export const aiService = new AIService();
