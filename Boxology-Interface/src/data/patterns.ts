import { shapes } from './shape';

// Helper function to find shape definition and get its colors
const getShapeColors = (name: string) => {
  // Capitalize first letter to match shape.ts definitions
  const normalizedName = name.charAt(0).toUpperCase() + name.slice(1);
  const shape = shapes.find(s => s.name === normalizedName);
  if (!shape) {
    console.warn(`Shape ${normalizedName} not found, using defaults`);
    return { color: '#FFFFFF', stroke: '#000000' };
  }
  return { color: shape.color, stroke: shape.stroke };
};

// Update all pattern node definitions to use capitalized shape names
function normalizePatternNodes(nodes: PatternNode[]): PatternNode[] {
  return nodes.map(node => ({
    ...node,
    name: node.name.charAt(0).toUpperCase() + node.name.slice(1),
    label: node.label,
    shape: node.shape, // shape type (e.g. 'Rectangle', 'Hexagon') should match shape.ts
    ...getShapeColors(node.name.charAt(0).toUpperCase() + node.name.slice(1)),
    x: node.x,
    y: node.y
  }));
}

// Pattern definitions based on your Boxology validation patterns
export interface PatternNode {
  id: string;
  name: string;
  label: string;
  shape: string;
  color: string;
  stroke: string;
  x: number;
  y: number;
  type?: string;
  parameter1?: number;
  group?: string;
  isShared?: boolean;
  sharedGroups?: string[];
}

export interface PatternLink {
  from: string;
  to: string;
}

export interface PatternCluster {
  id: string;
  label: string;
  category?: string;
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  nodes: PatternNode[];
  links: PatternLink[];
  clusters?: PatternCluster[];
  thumbnail?: string;
}

// Elementary patterns based on allPatterns from GoJSBoxologyValidation
export const elementaryPatterns: Pattern[] = [
  // Train model patterns
  {
    id: 'train_model_symbol',
    name: 'Use Symbol to Train a Model',
    description: 'Train a model from symbol Data',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'Symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'Train',
        label: 'id-Train',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 0
      },
      {
        id: '3',
        name: 'Model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 300, y: 0
      }
    ]),
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' }
    ]
  },
  
  {
    id: 'train_model_Data',
    name: 'Use Data to Train a Model',
    description: 'Train a model from Data',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'Train',
        label: 'id-Train',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 0
      },
      {
        id: '3',
        name: 'Model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 300, y: 0
      }
    ]),
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' }
    ]
  },

    // Generate model patterns
  {
    id: 'generate_model_Data',
    name: 'Generate Model from Model and Data',
    description: 'Generate model from existing model and Data',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'Model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 80
      },
      {
        id: '3',
        name: 'Train',
        label: 'id-Train',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 40
      },
      {
        id: '4',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 300, y: 40
      }
    ]),
    links: [
      { from: '1', to: '3' },
      { from: '2', to: '3' },
      { from: '3', to: '4' }
    ]
  },

  {
    id: 'generate_model_symbol',
    name: 'Generate Model from Model and Symbol',
    description: 'Generate model from existing model and symbol',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 80
      },
      {
        id: '3',
        name: 'Train',
        label: 'id-Train',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 40
      },
      {
        id: '4',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 300, y: 40
      }
    ]),
    links: [
      { from: '1', to: '3' },
      { from: '2', to: '3' },
      { from: '3', to: '4' }
    ]
  },


  // Transform patterns
  {
    id: 'transform_symbol_to_Data',
    name: 'Transform Symbol to Data',
    description: 'Transform symbol to Data',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'transform',
        label: 'id-transform',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 0
      },
      {
        id: '3',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 0
      }
    ]),
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' }
    ]
  },
  {
    id: 'transform_Data_to_Data',
    name: 'Transform Data to Data',
    description: 'Transform Data to Data',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'transform',
        label: 'id-transform',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 0
      },
      {
        id: '3',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 0
      }
    ]),
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' }
    ]
  },
  {
    id: 'transform_Data_model_to_Data',
    name: 'Transform Data and Model to Data',
    description: 'Transform Data and model to Data',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 0, y: 80
      },
      {
        id: '3',
        name: 'transform',
        label: 'id-transform',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 40
      },
      {
        id: '4',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 40
      }
    ]),
    links: [
      { from: '1', to: '3' },
      { from: '2', to: '3' },
      { from: '3', to: '4' }
    ]
  },

  {
    id: 'transform_Data_to_symbol',
    name: 'Transform Data to Symbol',
    description: 'Transform Data to symbol',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'transform',
        label: 'id-transform',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 0
      },
      {
        id: '3',
        name: 'symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 0
      }
    ]),
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' }
    ]
  },

  {
    id: 'transform_symbol_to_symbol',
    name: 'Transform Symbol to Symbol',
    description: 'Transform symbol to symbol',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'transform',
        label: 'id-transform',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 0
      },
      {
        id: '3',
        name: 'symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 0
      }
    ]),
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' }
    ]
  },
  {
    id: 'transform_model',
    name: 'Transform Model',
    description: 'Transform model to model',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'transform',
        label: 'id-transform',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 0
      },
      {
        id: '3',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 300, y: 0
      }
    ]),
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' }
    ]
  },

  // Engineer patterns
  {
    id: 'actor_Engineer_model',
    name: 'Actor Engineer a Model',
    description: 'Actor Engineers a model',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'actor',
        label: 'id-actor',
        shape: 'Triangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'Engineer',
        label: 'id-Engineer',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 0
      },
      {
        id: '3',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 300, y: 0
      }
    ]),
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' }
    ]
  },

  {
    id: 'actor_Engineer_symbol',
    name: 'Actor Engineer a Symbol',
    description: 'Actor Engineers a symbol',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'actor',
        label: 'id-actor',
        shape: 'Triangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'Engineer',
        label: 'id-Engineer',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 0
      },
      {
        id: '3',
        name: 'symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 0
      }
    ]),
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' }
    ]
  },

  {
    id: 'actor_Engineer_Data',
    name: 'Actor Engineer a Data',
    description: 'Actor Engineers Data',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'actor',
        label: 'id-actor',
        shape: 'Triangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'Engineer',
        label: 'id-Engineer',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 0
      },
      {
        id: '3',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 0
      }
    ]),
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' }
    ]
  },

  // Inference patterns
  {
    id: 'infer_symbol_from_symbol',
    name: 'Infer Symbol (Symbol + Model)',
    description: 'Infer symbol from model and symbol input',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 0, y: 80
      },
      {
        id: '3',
        name: 'deduce',
        label: 'id-deduce',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 40
      },
      {
        id: '4',
        name: 'symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 40
      }
    ]),
    links: [
      { from: '1', to: '3' },
      { from: '2', to: '3' },
      { from: '3', to: '4' }
    ]
  },

  {
    id: 'infer_symbol_from_Data',
    name: 'Infer Symbol (Data + Model)',
    description: 'Infer symbol from model and Data input',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 0, y: 80
      },
      {
        id: '3',
        name: 'deduce',
        label: 'id-deduce',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 40
      },
      {
        id: '4',
        name: 'symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 40
      }
    ]),
    links: [
      { from: '1', to: '3' },
      { from: '2', to: '3' },
      { from: '3', to: '4' }
    ]
  },

  {
    id: 'infer_model_from_symbol',
    name: 'Infer Model (Symbol + Model)',
    description: 'Infer model from symbol and model input',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 0, y: 80
      },
      {
        id: '3',
        name: 'deduce',
        label: 'id-deduce',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 40
      },
      {
        id: '4',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 300, y: 40
      }
    ]),
    links: [
      { from: '1', to: '3' },
      { from: '2', to: '3' },
      { from: '3', to: '4' }
    ]
  },

  {
    id: 'infer_model_from_Data',
    name: 'Infer Model (Data + Model)',
    description: 'Infer model from Data and model input',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 0, y: 80
      },
      {
        id: '3',
        name: 'deduce',
        label: 'id-deduce',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 40
      },
      {
        id: '4',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 300, y: 40
      }
    ]),
    links: [
      { from: '1', to: '3' },
      { from: '2', to: '3' },
      { from: '3', to: '4' }
    ]
  },

  {
    id: 'infer_Data_from_Data',
    name: 'Infer Data (Data + Model)',
    description: 'Infer Data from Data and model input',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 0, y: 80
      },
      {
        id: '3',
        name: 'deduce',
        label: 'id-deduce',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 40
      },
      {
        id: '4',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 40
      }
    ]),
    links: [
      { from: '1', to: '3' },
      { from: '2', to: '3' },
      { from: '3', to: '4' }
    ]
  },

  {
    id: 'infer_Data_from_symbol',
    name: 'Infer Data (Symbol + Model)',
    description: 'Infer Data from symbol and model input',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 0, y: 80
      },
      {
        id: '3',
        name: 'deduce',
        label: 'id-deduce',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 40
      },
      {
        id: '4',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 40
      }
    ]),
    links: [
      { from: '1', to: '3' },
      { from: '2', to: '3' },
      { from: '3', to: '4' }
    ]
  },
  {
    id: 'Data_symbol_transform',
    name: 'Data-Symbol Transform',
    description: 'Transform symbol and Data to Data',
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0
      },
      {
        id: '2',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 80
      },
      {
        id: '3',
        name: 'transform',
        label: 'id-transform',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 40
      },
      {
        id: '4',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 40
      }
    ]),
    links: [
      { from: '1', to: '3' },
      { from: '2', to: '3' },
      { from: '3', to: '4' }
    ]
  }
];

export const compositePatterns: Pattern[] = [
  // Train + inference composite pattern
  {
    id: 'learning-prediction',
    name: 'Learning and Prediction Task from Data',
    description: 'Train a model with data and then use it for prediction',
    clusters: [
      { id: 'learning_cluster', label: 'Learning', category: 'ClusterGroup' },
      { id: 'prediction_cluster', label: 'Prediction', category: 'ClusterGroup' }
    ],
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0,
        group: 'learning_cluster'
      },
      {
        id: '2',
        name: 'Train',
        label: 'id-Train',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 0,
        group: 'learning_cluster'
      },
      {
        id: '3',
        name: 'Model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 300, y: 0,
        sharedGroups: ['learning_cluster', 'prediction_cluster']
      },
      {
        id: '4',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 150, y: 150,
        group: 'prediction_cluster'
      },
      {
        id: '5',
        name: 'Deduce',
        label: 'id-deduce',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 300, y: 150,
        group: 'prediction_cluster'
      },
      {
        id: '6',
        name: 'Symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 450, y: 150,
        group: 'prediction_cluster'
      }
    ]),
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
      { from: '4', to: '5' },
      { from: '3', to: '5' },
      { from: '5', to: '6' }
    ]
  },
  {
    id: 'learning-prediction',
    name: 'Learning and Prediction Task from Symbol',
    description: 'Train a model with symbol and then use it for prediction',
    clusters: [
      { id: 'learning_cluster', label: 'Learning', category: 'ClusterGroup' },
      { id: 'prediction_cluster', label: 'Prediction', category: 'ClusterGroup' }
    ],
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'Symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 0,
        group: 'learning_cluster'
      },
      {
        id: '2',
        name: 'Train',
        label: 'id-Train',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 0,
        group: 'learning_cluster'
      },
      {
        id: '3',
        name: 'Model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 300, y: 0,
        sharedGroups: ['learning_cluster', 'prediction_cluster']
      },
      {
        id: '4',
        name: 'Symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 150, y: 150,
        group: 'prediction_cluster'
      },
      {
        id: '5',
        name: 'Deduce',
        label: 'id-deduce',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 300, y: 150,
        group: 'prediction_cluster'
      },
      {
        id: '6',
        name: 'Symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 450, y: 150,
        group: 'prediction_cluster'
      }
    ]),
    links: [
      { from: '1', to: '2' },
      { from: '2', to: '3' },
      { from: '4', to: '5' },
      { from: '3', to: '5' },
      { from: '5', to: '6' }
    ]
  },
{
    id: 'learning-inference',
    name: 'Learn Ontology from Data',
    description: 'Learn an ontology from data by first training a model and then using it to infer new knowledge, including hierarchies and axioms',
    clusters: [
      { id: 'group_1779964483811', label: 'Text Translated into Relation', category: 'ClusterGroup' },
      { id: 'group_1779964685138', label: 'Infer hierarchies and Axioms', category: 'ClusterGroup' }
    ],
    nodes: normalizePatternNodes([
      {
        id: '1',
        name: 'Data',
        label: 'id-Data',
        shape: 'Rectangle',
        color: '', stroke: '', x: 0, y: 150,
        group: 'group_1779964483811'
      },
      {
        id: '2',
        name: 'Model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 150, y: 0,
        group: 'group_1779964483811'
      },
      {
        id: '3',
        name: 'Deduce',
        label: 'infer:predict',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 150, y: 150,
        group: 'group_1779964483811'
      },
      {
        id: '4',
        name: 'Symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 300, y: 150,
        sharedGroups: ['group_1779964685138', 'group_1779964483811']
      },
      {
        id: '5',
        name: 'Model',
        label: 'id-model',
        shape: 'Hexagon',
        color: '', stroke: '', x: 450, y: 0,
        group: 'group_1779964685138'
      },
      {
        id: '6',
        name: 'Deduce',
        label: 'infer:deduce',
        shape: 'RoundedRectangle',
        color: '', stroke: '', x: 450, y: 150,
        group: 'group_1779964685138'
      },
      {
        id: '7',
        name: 'Symbol',
        label: 'id-symbol',
        shape: 'Rectangle',
        color: '', stroke: '', x: 600, y: 150,
        group: 'group_1779964685138'
      }
    ]),
    links: [
      { from: '1', to: '3' },
      { from: '2', to: '3' },
      { from: '3', to: '4' },
      { from: '4', to: '6' },
      { from: '5', to: '6' },
      { from: '6', to: '7' }
    ]
  },
];

