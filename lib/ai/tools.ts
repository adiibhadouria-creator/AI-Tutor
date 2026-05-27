export const startAssessmentTool = {
  type: "function",
  function: {
    name: "startAssessment",
    description:
      "Start the diagnostic quiz once the user has named a clear topic to learn.",
    parameters: {
      type: "object",
      properties: { topic: { type: "string", description: "The topic to assess." } },
      required: ["topic"],
    },
  },
} as const;

export const generateDiagramTool = {
  type: "function",
  function: {
    name: "generateDiagram",
    description:
      "Generate a labelled visual diagram for spatial or organic concepts that LaTeX can't capture.",
    parameters: {
      type: "object",
      properties: { prompt: { type: "string", description: "Detailed description of the diagram." } },
      required: ["prompt"],
    },
  },
} as const;
