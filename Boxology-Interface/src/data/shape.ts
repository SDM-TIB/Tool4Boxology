import { Label } from "@mui/icons-material";

export const shapes: ShapeDefinition[] = [
  // Data & Information
  { name: 'Symbol', label: 'id-symbol', shape: 'Rectangle', color: '#ccffccff', stroke: '#218721ff', group: 'Data & Information' },
  { name: 'Data', label: 'id-data', shape: 'Rectangle', color: '#b7eaffff', stroke: '#1E5F8B', group: 'Data & Information' },
  //{ name: 'artifact', label: 'id-artifact', shape: 'Rectangle', color: '#99e5e1ff', stroke: '#0D5F5C', group: 'Data & Information' },

  // Actors & Entities
  { name: 'Actor', label: 'id-actor', shape: 'Triangle', color: '#f8ce92ff', stroke: '#000000ff', group: 'Actors & Entities' },

  // AI & Models
  { name: 'Model', label: 'id-model', shape: 'Hexagon', color: '#f4ccf4ff', stroke: '#8B4F8B', group: 'AI & Models' },
  //{ name: 'SemanticModel', label: 'id-SemanticModel', shape: 'Hexagon', color: '#f4ccf4ff', stroke: '#8B4F8B', group: 'AI & Models' },
  //{ name: 'StatisticalModel', label: 'id-StatisticalModel', shape: 'Hexagon', color: '#f4ccf4ff', stroke: '#8B4F8B', group: 'AI & Models' },

  // Processes & Actions
  { name: 'Transform', label: 'id-transform', shape: 'RoundedRectangle',color: '#fbf2a2ff', stroke: '#B8A600', group: 'Processes & Actions' },
  { name: 'Deduce', label: 'id-deduce', shape: 'RoundedRectangle', color: '#FFC4C4', stroke: '#4c003bff', group: 'Processes & Actions' },
  { name: 'Train', label: 'id-training', shape: 'RoundedRectangle', color: '#FFA07A', stroke: '#CD5C5C', group: 'Processes & Actions' },
  { name: 'Engineer', label: 'id-engineering', shape: 'RoundedRectangle', color: '#F5E5E1', stroke: '#C1307A', group: 'Processes & Actions' },
  //{ name: 'generate', label: 'id-generate', shape: 'RoundedRectangle', color: '#f067acff', stroke: '#C1307A', group: 'Processes & Actions' },
  //{ name: 'embedding', label: 'id-embedding', shape: 'RoundedRectangle', borderRadius: '45px', color: '#5a562fff', stroke: '#B8A600', group: 'Processes & Actions' },

  // Documentation
  { name: 'comment', label: 'id-comment', shape: 'Rectangle', color: '#F5F5DC', stroke: '#A9A9A9', group: 'Documentation' },
];

// ADD: Type definitions for each shape
export const shapeTypesMin: Record<string, string[]> = {
  "symbol": ["symbol", "Trace", "Label", "Knowledge Graph","Rules"],
  "data": ["data", "Number","Dataset", "Tensor", "Text", "Image", "Audio", "Video", "Table", "Time Series"],
  //"artifact": ["artifact", "data", "symbol"],
  "model": ["model", "StatisticModel", "SemanticModel", "HybridModel"],
  "SemanticModel": ["SemanticModel", "Embedding Model", "Knowledge Graph Embedding"],
  "StatisticalModel": ["StatisticalModel", "Regression", "Classification", "Clustering"],
  "NeuralModel": ["NeuralModel", "CNN", "RNN", "Transformer","LLM"],
  "actor": ["actor", "Human", "Robot"],
  //"generate": ["generate", "train", "engineer"],
  "training": ["training","Symbolic Learning", "Statistical Learning", "Deep Learning", "Reinforcement Learning"],
  "engineering": ["engineering"],
  "deduce": ["deduce", "classification", "prediction"],
  //"infer": ["infer", "deduce", "induction"],
  "induction": ["induction"],
  "transform": ["transform", "embed", "Normalize", "aggregate"],
  "embed": ["embed"],
  "comment": ["comment"]
};


export type GoShape =
  | 'Rectangle'
  | 'RoundedRectangle'
  | 'Diamond'
  | 'Ellipse'
  | 'Triangle'
  | 'TriangleDown'
  | 'Hexagon';

export interface ShapeDefinition {
  name: string;
  label: string;
  shape: GoShape;
  color: string;
  stroke: string;
  group: string;
  borderRadius?: '45px';
}

export type ShapeTypeTree = {
  [type: string]: ShapeTypeTree | null;
};

export const shapeTypesTree: ShapeTypeTree = {
  Actor: {
    Human: null,
    Robot: null
  },  
  Data: {
    Number: null,
    Dataset: null,
    Tensor: null,
    Text: null,
    Image: null,
    Audio: null,
    Video: null,
    TimeSeries: null
  },
  Symbol: {
    DB: null,
    KG: null,
    Label: null,
    Trace: null,
    Rules: null
  },

  Model: {
    InductiveModel: {
      NumericModel: null,
      SymbolicLearningModel: {
        SelfSupervisedRuleMiningModel: {
          AxiomMiningModel: null
        },
        UnsupervisedCommunityDetectionModel: null
      }
    },
    NeuralModel: {
      NeuralNetwork: {
        CNN: null,
        RNN: {
          LSTM: null,
          GRU: null
        },
        Transformer: {
          DecoderOnlyTransformer: null,
          EncoderDecoderTransformer: null,
          EncoderOnlyTransformer: null
        },
        GNN: {
          GCN: null,
          GAT: null,
          SupervisedGraphNNModel: null
        }
      },
      LLM: null
    },
    SemanticModel: {
      OWLOntology: null,
      RDFModel: null,
      RDFSModel: null,
      RuleBasedModel: null,
      SHACLShapesModel: null
    },
    StatisticalModel: {
      RegressionModel: null,
      ClassificationModel: null,
      ClusteringModel: null,
      FuzzyModel: null
    }
  },

  Transform: null,
  Deduce: null,
  Train: null,
  Engineer: null,
  comment: null,

  // ...add other root types as needed
};

