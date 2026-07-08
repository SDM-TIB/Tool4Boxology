import type { Pattern } from './patterns';

// Kautz model patterns extracted from the six Generic Kautz boxology files.
export const kautzPatterns: Pattern[] = [
  {
//Kautz category1: Symbolic > Neuro [SymbolicInput/SymbolicOutput]
    id: 'symbolic>neuro',
    name: 'Symbolic > Neuro [SymbolicInput/SymbolicOutput]',
    description: 'Symbolic information guides the neural component',
    nodes: [
      {
        id: 'symbolic_input',
        name: 'Symbol',
        label: 'Symbolic Input',
        shape: 'Rectangle',
        color: '#ccffccff',
        stroke: '#218721ff',
        x: 204,
        y: 336,
      },
      {
        id: 'embedding_model',
        name: 'Model',
        label: 'Embedding Model',
        shape: 'Hexagon',
        color: '#f4ccf4ff',
        stroke: '#8B4F8B',
        x: 204,
        y: 256,
      },
      {
        id: 'train_action',
        name: 'Train',
        label: 'train',
        shape: 'RoundedRectangle',
        color: '#FFA07A',
        stroke: '#CD5C5C',
        x: 354,
        y: 296,

      },
    {
        id: 'embedding',
        name: 'Model',
        label: 'Embedding',
        shape: 'Hexagon',
        color: '#f4ccf4ff',
        stroke: '#8B4F8B',
        x: 504,
        y: 296,
      },
   {
        id: 'nn_deduce',
        name: 'Deduce',
        label: 'nn:Deduce',
        shape: 'RoundedRectangle',
        color: '#FFC4C4',
        stroke: '#4c003bff',
        x: 662.1406155725914,
        y: 296.2204801202704,
      },
      {
        id: 'neural-network',
        name: 'Neural Network',
        label: 'Neural Network(NN)',
        shape: 'Hexagon',
        color: '#f4ccf4ff',
        stroke: '#8B4F8B',
        x: 662.1406155725914,
        y: 196.99993655614688,
      },
      {
        id: 'symbolic_output',
        name: 'Symbol',
        label: 'Symbolic Output',
        shape: 'Rectangle',
        color: '#ccffccff',
        stroke: '#218721ff',
        x: 803.0997971484474,
        y: 296.22048012027045,
      },
    ],
    links: [
      { from: 'symbolic_input', to: 'train_action' },
      { from: 'embedding_model', to: 'train_action' },
      { from: 'train_action', to: 'embedding' },
      { from: 'embedding', to: 'nn_deduce' },
      { from: 'neural-network', to: 'nn_deduce' },
      { from: 'nn_deduce', to: 'symbolic_output' },
    ],
  },

//Kautz category1: symbolic > Neuro [DataInput/SymbolicOutput] 
  {
    id: 'symbolic>neuro',
    name: 'Symbolic > Neuro [DataInput/SymbolicOutput]',
    description: 'Symbolic information guides the neural component',
    nodes: [
      {
        id: 'data_input',
        name: 'Data',
        label: 'Data Input',
        shape: 'Rectangle',
        color: '#b7eaffff',
        stroke: '#1E5F8B',
        x: 204,
        y: 336,
      },
      {
        id: 'embedding_model',
        name: 'Model',
        label: 'Embedding Model',
        shape: 'Hexagon',
        color: '#f4ccf4ff',
        stroke: '#8B4F8B',
        x: 204,
        y: 256,
      },
      {
        id: 'train_action',
        name: 'Train',
        label: 'train',
        shape: 'RoundedRectangle',
        color: '#FFA07A',
        stroke: '#CD5C5C',
        x: 354,
        y: 296,

      },
    {
        id: 'embedding',
        name: 'Model',
        label: 'Embedding',
        shape: 'Hexagon',
        color: '#f4ccf4ff',
        stroke: '#8B4F8B',
        x: 504,
        y: 296,
      },
   {
        id: 'nn_deduce',
        name: 'Deduce',
        label: 'nn:Deduce',
        shape: 'RoundedRectangle',
        color: '#FFC4C4',
        stroke: '#4c003bff',
        x: 662.1406155725914,
        y: 296.2204801202704,
      },
      {
        id: 'neural-network',
        name: 'Neural Network',
        label: 'Neural Network(NN)',
        shape: 'Hexagon',
        color: '#f4ccf4ff',
        stroke: '#8B4F8B',
        x: 662.1406155725914,
        y: 196.99993655614688,
      },
      {
        id: 'symbolic_output',
        name: 'Symbol',
        label: 'Symbolic Output',
        shape: 'Rectangle',
        color: '#ccffccff',
        stroke: '#218721ff',
        x: 803.0997971484474,
        y: 296.22048012027045,
      },
    ],
    links: [
      { from: 'data_input', to: 'train_action' },
      { from: 'embedding_model', to: 'train_action' },
      { from: 'train_action', to: 'embedding' },
      { from: 'embedding', to: 'nn_deduce' },
      { from: 'neural-network', to: 'nn_deduce' },
      { from: 'nn_deduce', to: 'symbolic_output' },
    ],
  },

//Kautz category1: symbolic > Neuro [SymbolicInput/DataOutput] 
  {
    id: 'symbolic>neuro',
    name: 'Symbolic > Neuro [SymbolicInput/DataOutput]',
    description: 'Symbolic information guides the neural component',
    nodes: [
      {
        id: 'symbolic_input',
        name: 'Symbolic',
        label: 'Symbolic Input',
        shape: 'Rectangle',
        color: '#ccffccff',
        stroke: '#218721ff',
        x: 204,
        y: 336,
      },
      {
        id: 'embedding_model',
        name: 'Model',
        label: 'Embedding Model',
        shape: 'Hexagon',
        color: '#f4ccf4ff',
        stroke: '#8B4F8B',
        x: 204,
        y: 256,
      },
      {
        id: 'train_action',
        name: 'Train',
        label: 'train',
        shape: 'RoundedRectangle',
        color: '#FFA07A',
        stroke: '#CD5C5C',
        x: 354,
        y: 296,

      },
    {
        id: 'embedding',
        name: 'Model',
        label: 'Embedding',
        shape: 'Hexagon',
        color: '#f4ccf4ff',
        stroke: '#8B4F8B',
        x: 504,
        y: 296,
      },
   {
        id: 'nn_deduce',
        name: 'Deduce',
        label: 'nn:Deduce',
        shape: 'RoundedRectangle',
        color: '#FFC4C4',
        stroke: '#4c003bff',
        x: 662.1406155725914,
        y: 296.2204801202704,
      },
      {
        id: 'neural-network',
        name: 'Neural Network',
        label: 'Neural Network(NN)',
        shape: 'Hexagon',
        color: '#f4ccf4ff',
        stroke: '#8B4F8B',
        x: 662.1406155725914,
        y: 196.99993655614688,
      },
      {
        id: 'data_output',
        name: 'Data',
        label: 'Data Output',
        shape: 'Rectangle',
        color: '#b7eaffff',
        stroke: '#1E5F8B',
        x: 803.0997971484474,
        y: 296.22048012027045,
      },
    ],
    links: [
      { from: 'symbolic_input', to: 'train_action' },
      { from: 'embedding_model', to: 'train_action' },
      { from: 'train_action', to: 'embedding' },
      { from: 'embedding', to: 'nn_deduce' },
      { from: 'neural-network', to: 'nn_deduce' },
      { from: 'nn_deduce', to: 'data_output' },
    ],
  },

//Kautz category1: symbolic > Neuro [DataInput/DataOutput] 
  {
    id: 'symbolic>neuro',
    name: 'Symbolic > Neuro [DataInput/DataOutput]',
    description: 'Symbolic information guides the neural component',
    nodes: [
      {
        id: 'data_input',
        name: 'Data',
        label: 'Data Input',
        shape: 'Rectangle',
        color: '#b7eaffff',
        stroke: '#1E5F8B',
        x: 204,
        y: 336,
      },
      {
        id: 'embedding_model',
        name: 'Model',
        label: 'Embedding Model',
        shape: 'Hexagon',
        color: '#f4ccf4ff',
        stroke: '#8B4F8B',
        x: 204,
        y: 256,
      },
      {
        id: 'train_action',
        name: 'Train',
        label: 'train',
        shape: 'RoundedRectangle',
        color: '#FFA07A',
        stroke: '#CD5C5C',
        x: 354,
        y: 296,

      },
    {
        id: 'embedding',
        name: 'Model',
        label: 'Embedding',
        shape: 'Hexagon',
        color: '#f4ccf4ff',
        stroke: '#8B4F8B',
        x: 504,
        y: 296,
      },
   {
        id: 'nn_deduce',
        name: 'Deduce',
        label: 'nn:Deduce',
        shape: 'RoundedRectangle',
        color: '#FFC4C4',
        stroke: '#4c003bff',
        x: 662.1406155725914,
        y: 296.2204801202704,
      },
      {
        id: 'neural-network',
        name: 'Neural Network',
        label: 'Neural Network(NN)',
        shape: 'Hexagon',
        color: '#f4ccf4ff',
        stroke: '#8B4F8B',
        x: 662.1406155725914,
        y: 196.99993655614688,
      },
      {
        id: 'data_output',
        name: 'Data',
        label: 'Data Output',
        shape: 'Rectangle',
        color: '#b7eaffff',
        stroke: '#1E5F8B',
        x: 803.0997971484474,
        y: 296.22048012027045,
      },
    ],
    links: [
      { from: 'data_input', to: 'train_action' },
      { from: 'embedding_model', to: 'train_action' },
      { from: 'train_action', to: 'embedding' },
      { from: 'embedding', to: 'nn_deduce' },
      { from: 'neural-network', to: 'nn_deduce' },
      { from: 'nn_deduce', to: 'data_output' },
    ],
  },
//Kautz category2: Neuro > Symbolic [DataInput/DataOutput]

{
    id: 'neuro>symbolic',
    name: 'Neuro > Symbolic [DataInput/DataOutput]',
    description: ' A neuralmodel produces outputs that are consumed by a symbolic solver or reasoning component.',
    nodes: [
      { id: "node_17823071852981", name: "Data", label: "Data", shape: "Rectangle", color: "#b7eaffff", stroke: "#1E5F8B", x: 174, y: 183, type: "Data" },
      { id: "node_17823071852982", name: "Model", label: "Neural Network (NN)", shape: "Hexagon", color: "#f4ccf4ff", stroke: "#8B4F8B", x: 247, y: 56.000030517578125, type: "NeuralNetwork" },
      { id: "node_17823071852983", name: "Deduce", label: "ss:deduce", shape: "RoundedRectangle", color: "#FFC4C4", stroke: "#4c003bff", x: 324, y: 183, type: "Deduce", parameter1: 15 },
      { id: "node_17823071852994", name: "Data", label: "Data", shape: "Rectangle", color: "#b7eaffff", stroke: "#1E5F8B", x: 474, y: 183, type: "Data" },
      { id: "node_1782307198834", name: "Model", label: "Symbolic Solver (SS)", shape: "Hexagon", color: "#f4ccf4ff", stroke: "#8B4F8B", x: 395.5, y: 55, type: "Model", parameter1: 1 }
],
 links: [
{from:"node_17823071852981",to:"node_17823071852983"},
{from:"node_17823071852982",to:"node_17823071852983"},
{from:"node_17823071852983",to:"node_17823071852994"},
{from:"node_1782307198834",to:"node_17823071852983"}
]},

//Kautz category2: Neuro > Symbolic [DataInput/SymbolicOutput]

{
    id: 'neuro>symbolic',
    name: 'Neuro > Symbolic [DataInput/SymbolicOutput]',
    description: ' A neuralmodel produces outputs that are consumed by a symbolic solver or reasoning component.',
    nodes: [
      { id: "node_17823071852981", name: "Data", label: "Data", shape: "Rectangle", color: "#b7eaffff", stroke: "#1E5F8B", x: 174, y: 183, type: "Data" },
      { id: "node_17823071852982", name: "Model", label: "Neural Network (NN)", shape: "Hexagon", color: "#f4ccf4ff", stroke: "#8B4F8B", x: 247, y: 56.000030517578125, type: "NeuralNetwork" },
      { id: "node_17823071852983", name: "Deduce", label: "ss:deduce", shape: "RoundedRectangle", color: "#FFC4C4", stroke: "#4c003bff", x: 324, y: 183, type: "Deduce", parameter1: 15 },
      { id: "node_17823071852994", name: "symbol", label: "Symbol", shape: "Rectangle", color: '#ccffccff', stroke: '#218721ff', x: 474, y: 183, type: "Symbol" },
      { id: "node_1782307198834", name: "Model", label: "Symbolic Solver (SS)", shape: "Hexagon", color: "#f4ccf4ff", stroke: "#8B4F8B", x: 395.5, y: 55, type: "Model", parameter1: 1 }
],
 links: [
{from:"node_17823071852981",to:"node_17823071852983"},
{from:"node_17823071852982",to:"node_17823071852983"},
{from:"node_17823071852983",to:"node_17823071852994"},
{from:"node_1782307198834",to:"node_17823071852983"}
]},

//Kautz category2: Neuro > Symbolic [SymbolicInput/SymbolicOutput]

{    id: 'neuro>symbolic',
    name: 'Neuro > Symbolic [SymbolicInput/SymbolicOutput]',
    description: ' A neuralmodel produces outputs that are consumed by a symbolic solver or reasoning component.',
    nodes: [
      { id: "node_17823071852981", name: "Symbol", label: "Symbol", shape: "Rectangle", color: '#ccffccff', stroke: '#218721ff', x: 174, y: 183, type: "Data" },
      { id: "node_17823071852982", name: "Model", label: "Neural Network (NN)", shape: "Hexagon", color: "#f4ccf4ff", stroke: "#8B4F8B", x: 247, y: 56.000030517578125, type: "NeuralNetwork" },
      { id: "node_17823071852983", name: "Deduce", label: "ss:deduce", shape: "RoundedRectangle", color: "#FFC4C4", stroke: "#4c003bff", x: 324, y: 183, type: "Deduce", parameter1: 15 },
      { id: "node_17823071852994", name: "symbol", label: "Symbol", shape: "Rectangle", color: '#ccffccff', stroke: '#218721ff', x: 474, y: 183, type: "Symbol" },
      { id: "node_1782307198834", name: "Model", label: "Symbolic Solver (SS)", shape: "Hexagon", color: "#f4ccf4ff", stroke: "#8B4F8B", x: 395.5, y: 55, type: "Model", parameter1: 1 }
],
 links: [
{from:"node_17823071852981",to:"node_17823071852983"},
{from:"node_17823071852982",to:"node_17823071852983"},
{from:"node_17823071852983",to:"node_17823071852994"},
{from:"node_1782307198834",to:"node_17823071852983"}
]},

//Kautz category2: Neuro > Symbolic [SymbolicInput/DataOutput]

{
    id: 'neuro>symbolic',
    name: 'Neuro > Symbolic [SymbolicInput/DataOutput]',
    description: ' A neural model produces outputs that are consumed by a symbolic solver or reasoning component.',
    nodes: [
      { id: "node_17823071852981", name: "Symbol", label: "Symbol", shape: "Rectangle", color: '#ccffccff', stroke: '#218721ff', x: 174, y: 183, type: "Data" },
      { id: "node_17823071852982", name: "Model", label: "Neural Network (NN)", shape: "Hexagon", color: "#f4ccf4ff", stroke: "#8B4F8B", x: 247, y: 56.000030517578125, type: "NeuralNetwork" },
      { id: "node_17823071852983", name: "Deduce", label: "ss:deduce", shape: "RoundedRectangle", color: "#FFC4C4", stroke: "#4c003bff", x: 324, y: 183, type: "Deduce", parameter1: 15 },
      { id: "node_17823071852994", name: "data", label: "Data", shape: "Rectangle", color: "#b7eaffff", stroke: "#1E5F8B", x: 474, y: 183, type: "Data" },
      { id: "node_1782307198834", name: "Model", label: "Symbolic Solver (SS)", shape: "Hexagon", color: "#f4ccf4ff", stroke: "#8B4F8B", x: 395.5, y: 55, type: "Model", parameter1: 1 },
    ],
 links: [
{from:"node_17823071852981",to:"node_17823071852983"},
{from:"node_17823071852982",to:"node_17823071852983"},
{from:"node_17823071852983",to:"node_17823071852994"},
{from:"node_1782307198834",to:"node_17823071852983"}
]},

//Kautz category3: Neuro: Symbolic> Neuro
{
    id: 'neuro:symbolic>neuro',
    name: 'Neuro: Symbolic>Neuro',
    description: ' Symbolic rules or annotations influence the learning process of aneural model.',
 nodes: [
{id:"node_17823077123811",name:"Symbol",label:"Symbol",shape:"Rectangle",color:"#ccffccff",stroke:"#218721ff",x:260, y:117,type:"Symbol"},
{id:"node_17823077123842",name:"Model",label:"Symbolic Model",shape:"Hexagon",color:"#f4ccf4ff",stroke:"#8B4F8B",x:259, y:217,type:"SymbolicLearningModel"},
{id:"node_17823077123843",name:"Deduce",label:"infer:deduce",shape:"RoundedRectangle",color:"#FFC4C4",stroke:"#4c003bff",x:408, y:177,type:"Deduce",parameter1:15},
{id:"node_17823077123844",name:"Symbol",label:"Annotated Symbol",shape:"Rectangle",color:"#ccffccff",stroke:"#218721ff",x:408, y:286.5000305175781,type:"Symbol"},
{id:"node_17823077258901",name:"Model",label:"NN Approach",shape:"Hexagon",color:"#f4ccf4ff",stroke:"#8B4F8B",x:570.5001220703125, y:162.00003051757812,type:"Model"},
{id:"node_17823077258913",name:"Train",label:"Train",shape:"RoundedRectangle",color:"#FFA07A",stroke:"#CD5C5C",x:570.5, y:286.5000305175781,type:"Train",parameter1:15},
{id:"node_17823077258924",name:"Model",label:"NN Model",shape:"Hexagon",color:"#f4ccf4ff",stroke:"#8B4F8B",x:706.5000610351562, y:287,type:"Model"}
],
  links: [
{from:"node_17823077123811",to:"node_17823077123843"},
{from:"node_17823077123842",to:"node_17823077123843"},
{from:"node_17823077123843",to:"node_17823077123844"},
{from:"node_17823077258901",to:"node_17823077258913"},
{from:"node_17823077123844",to:"node_17823077258913"},
{from:"node_17823077258913",to:"node_17823077258924"}
]},


];
