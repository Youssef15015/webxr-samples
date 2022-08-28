// Copyright 2018 The Immersive Web Community Group
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import {Material} from '../core/material.js';
import {Node} from '../core/node.js';
import {Primitive, PrimitiveAttribute} from '../core/primitive.js';
import {SevenSegmentText} from './seven-segment-text.js';

const SEGMENTS = 30;
let barStart = -1.0;
let barWidth = 0.2;
let barSpacing = 0.3;
let graphValues = [];
let graphValues2 = [];
let graphValues3 = [];
let graphHorStart = -0.105;
let graphSpacing = 0.350;
let graphWidth =  0.305;
let graphThickness = 0.01;
let graphLength = 0.55 

let sizeKey = true;
let sizeKey2 = true;
let sizeKey3 = true;

class StatsMaterial extends Material {
  get materialName() {
    return 'STATS_VIEWER';
  }

  get vertexSource() {
    return `
    attribute vec3 POSITION;
    attribute vec3 COLOR_0;
    varying vec4 vColor;
    vec4 vertex_main(mat4 proj, mat4 view, mat4 model) {
      vColor = vec4(COLOR_0, 1.0);
      return proj * view * model * vec4(POSITION, 1.0);
    }`;
  }

  get fragmentSource() {
    return `
    precision mediump float;
    varying vec4 vColor;
    vec4 fragment_main() {
      return vColor;
    }`;
  }
}

function valuesToBar(x,xmax) {
  return ( x * (1.65/xmax)) - 0.9;
}

function valuesToGraph(n,x,xmax,t,tmax) {
  let xpixels = ( x * (graphLength/xmax)) ;
  let tpixels = ( t *(graphWidth/tmax)) + (graphHorStart +graphSpacing*n);
// console.log(tpixels);
  return [tpixels,xpixels];
}

function findMax(x) {
	//I will change this to a better algorithim later, for now I'll keep it like this to save time and any issues of bugs. 
	let xmax = 0;
	if (x < 1)
		{xmax = 1}
	else if (x < 10)
		{xmax = 10}
	else if (x < 100 )
		{xmax = 100 }
	// else if (x <200)
	// 	{xmax = 200}
	// else if (x <300)
	// 	{xmax = 300}
	// else if (x <400)
	// 	{xmax = 400}
	// else if (x <500)
	// 	{xmax = 500}
	// else if (x <600)
	// 	{xmax = 600}
  else if (x <1000)
	  {xmax = 1000}
	else if (x < 10000)
		{xmax = 10000}
	else {
		console.log("Error, maximum scale reached;");
		alert('This scale is too high!');
		return 0;
	}
	return xmax;
}

function segmentToX(i) {
  return ((2.00/30) * i) - 1.00;
}

//Draw the text on a canvas
//Potential method instead of segmented text method
function drawTextCanvas(text,width,height)
{
    var newCanvasContext = document.createElement("canvas").getContext("2d");
    newCanvasContext.canvas.width = width;
    newCanvasContext.canvas.height = height;
    newCanvasContext.textBaseline = "middle";
    newCanvasContext.textAlign = "ceneter";
    newCanvasContext.clearRect(0,0,newCanvasContext.canvas.width,newCanvasContext.canvas.height);
    newCanvasContext.fillText(text,width/2,height/2);
    return newCanvasContext.canvas;
}

let now = (window.performance && performance.now) ? performance.now.bind(performance) : Date.now;

export class BoardViewer extends Node {
  constructor() {
    super();
    this._barStart = barStart;
    this._barWidth = barWidth;
    this._barSpacing = barSpacing;
    this._displacements = [];
    this._velocities = [];
    this._accelerations = [];
    this._times = [];
    this._displacement = 0;
    this._acceleration = 0;
    this._velocity =0;
    this._time = 0;
    this._displacementMax = 0;
    this._velocityMax = 0;
    this._accelerationMax = 0;
    this._timeMax = 0;
    this._startTime = now();
    this._pauseTime = 0;
    this._simulationTime = 0;
    this._prevGraphUpdateTime = this._startTime;
    this._lastSegment = 0;
    this._plotVertexBuffer = null;
    this._plotRenderPrimitive = null;
    this._plotVertexBuffer2 = null;
    this._plotRenderPrimitive2 = null;
    this._plotVertexBuffer2 = null;
    this._plotRenderPrimitive2 = null;
    this._boardNode = null;
    
    this._sevenSegmentNodes = []
    for(let i = 0; i < 6; i++)
    {
      this._sevenSegmentNodes.push(new SevenSegmentText());
    }
  }

  onRendererChanged(renderer) {
    this.clearNodes();

    let gl = renderer.gl;

    let boardVerts = [];
    let boardIndices = [];

    let plotVerts = [];
    let plotIndices = [];

    let plotVerts2 = [];
    let plotIndices2 = [];

    let plotVerts3 = [];
    let plotIndices3 = [];

    //Graph geometry
    for (let i = 0; i < SEGMENTS; ++i) {
      //Bar top
      boardVerts.push(segmentToX(i), -0.9, 0.02, 0.0, 1.0, 1.0);
      boardVerts.push(segmentToX(i+1), -0.9, 0.02, 0.0, 1.0, 1.0);

      //Bar bottom
      boardVerts.push(segmentToX(i), -0.9, 0.02, 0.0, 1.0, 1.0);
      boardVerts.push(segmentToX(i+1), -0.9, 0.02, 0.0, 1.0, 1.0);

      let idx = i * 4;
      boardIndices.push(idx, idx+3, idx+1,
                       idx+3, idx, idx+2);
    }

    //Plots
    for (let i = 0; i < 1000; ++i) {
      plotVerts.push(graphHorStart, 0.0, 0.0, 0.0, 0.0, 0.00);
      plotVerts.push(graphHorStart, 0.0, 0.0, 0.0, 0.0, 0.00);

      plotVerts.push(graphHorStart, 0.0, 0.0, 0.0, 0.0, 0.00);
      plotVerts.push(graphHorStart, 0.0, 0.0, 0.0, 0.0, 0.00);

      let idx = i * 4;
      plotIndices.push(idx, idx+3, idx+1,
                       idx+3, idx, idx+2);
    }
    for (let i = 0; i < 1000; ++i) {
      plotVerts2.push(graphHorStart + graphSpacing, 0.0, 0.0, 0.0, 0.0, 0.125);
      plotVerts2.push(graphHorStart + graphSpacing, 0.0, 0.0, 0.0, 0.0, 0.125);

      plotVerts2.push(graphHorStart + graphSpacing, 0.0, 0.0, 0.0, 0.0, 0.125);
      plotVerts2.push(graphHorStart + graphSpacing, 0.0, 0.0, 0.0, 0.0, 0.125);

      let idx = i * 4;
      plotIndices2.push(idx, idx+3, idx+1,
                       idx+3, idx, idx+2);
    }
    for (let i = 0; i < 1000; ++i) {
      plotVerts3.push(graphHorStart + graphSpacing * 2, 0.0, 0.0, 0.0, 0.0, 0.125);
      plotVerts3.push(graphHorStart + graphSpacing * 2, 0.0, 0.0, 0.0, 0.0, 0.125);

      plotVerts3.push(graphHorStart + graphSpacing * 2, 0.0, 0.0, 0.0, 0.0, 0.125);
      plotVerts3.push(graphHorStart + graphSpacing * 2, 0.0, 0.0, 0.0, 0.0, 0.125);

      let idx = i * 4;
      plotIndices3.push(idx, idx+3, idx+1,
                       idx+3, idx, idx+2);
    }

    function addBGSquare(left, bottom, right, top, z, r, g, b) {
      let idx = boardVerts.length / 6;

      boardVerts.push(left, bottom, z, r, g, b);
      boardVerts.push(right, top, z, r, g, b);
      boardVerts.push(left, top, z, r, g, b);
      boardVerts.push(right, bottom, z, r, g, b);

      boardIndices.push(idx, idx+1, idx+2,
                       idx, idx+3, idx+1);
  
    }

    //Experimental line to be added from the start.
    function addLine(left, bottom, right, top,z,r,g,b) {

      plotVerts.push(left, bottom, z, r, g, b);
      plotVerts.push(right, top, z, r, g, b);
  
      plotIndices.push(0, 1);
    }

    //Add circle later
    function addCircle ()
    {

    }

    // Panel Background
    addBGSquare(-1.2, -1.2, 1.2, 1.2, 0.0, 0.0, 0.0, 0.125);
    //Bars
    addBGSquare(barStart, -0.9, barStart + barWidth, 0.75, 0.015, 0.95, 0.95, 0.95);
    addBGSquare(barStart + barSpacing, -0.9, barStart + barWidth + barSpacing , 0.75, 0.015, 0.95, 0.95, 0.95);
    addBGSquare(barStart + 2 * barSpacing, -0.9, barStart + barWidth + 2 * barSpacing , 0.75, 0.015, 0.95, 0.95, 0.95);

    //Graphs
    //Verticals
    addBGSquare(graphHorStart, 0.0, graphHorStart + graphThickness, graphLength, 0.015, 0.95, 0.95, 0.95);
    addBGSquare(graphHorStart + graphSpacing, 0.0, graphHorStart + graphSpacing + graphThickness, graphLength, 0.015, 0.95, 0.95, 0.95);
    addBGSquare(graphHorStart + 2 * graphSpacing, 0.0, graphHorStart + 2 * graphSpacing + graphThickness, graphLength, 0.015, 0.95, 0.95, 0.95);
    //Horizontals
    addBGSquare(graphHorStart, -0.005, graphHorStart + graphWidth, -0.005 + graphThickness, 0.015, 0.95, 0.95, 0.95);
    addBGSquare(graphHorStart + graphSpacing, -0.005, graphHorStart + graphSpacing + graphWidth, -0.005 + graphThickness, 0.015, 0.95, 0.95, 0.95);
    addBGSquare(graphHorStart + 2 * graphSpacing, -0.005, graphHorStart + 2 * graphSpacing + graphWidth, -0.005 + graphThickness, 0.015, 0.95, 0.95, 0.95);

    let origin = new Float32Array([0.075, 0, 0, 0, 0, 0.075, 0, 0, 0, 0, 1, 0,-0.3625, 0.3625, 0.02, 1,]);
    for(let i = 0; i < 6; i++)
    {
      this._sevenSegmentNodes[i].matrix = origin;
      this._sevenSegmentNodes[i].scale = [0.05,0.05,1];
    }
    this._sevenSegmentNodes[0].translation = [-0.925,0.9,0.015];
    this._sevenSegmentNodes[1].translation = [-0.625,0.9,0.015];
    this._sevenSegmentNodes[2].translation = [-0.325,0.9,0.015];
    this._sevenSegmentNodes[3].translation = [-0.125,0.65,0.015];
    this._sevenSegmentNodes[4].translation = [0.235,0.65,0.015];
    this._sevenSegmentNodes[5].translation = [0.59,0.65,0.015];
    for(let i = 0; i < 6; i++)
    {
      this.addNode(this._sevenSegmentNodes[i]);
    }

    this._plotVertexBuffer = renderer.createRenderBuffer(gl.ARRAY_BUFFER, new Float32Array(plotVerts), gl.DYNAMIC_DRAW);
    let plotIndexBuffer = renderer.createRenderBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(plotIndices));

    this._plotVertexBuffer2 = renderer.createRenderBuffer(gl.ARRAY_BUFFER, new Float32Array(plotVerts2), gl.DYNAMIC_DRAW);
    let plotIndexBuffer2 = renderer.createRenderBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(plotIndices2));

    this._plotVertexBuffer3 = renderer.createRenderBuffer(gl.ARRAY_BUFFER, new Float32Array(plotVerts3), gl.DYNAMIC_DRAW);
    let plotIndexBuffer3 = renderer.createRenderBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(plotIndices3));

    this._boardVertexBuffer = renderer.createRenderBuffer(gl.ARRAY_BUFFER, new Float32Array(boardVerts), gl.DYNAMIC_DRAW);
    let boardIndexBuffer = renderer.createRenderBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(boardIndices));

    let boardAttribs = [
      new PrimitiveAttribute('POSITION', this._boardVertexBuffer, 3, gl.FLOAT, 24, 0),
      new PrimitiveAttribute('COLOR_0', this._boardVertexBuffer, 3, gl.FLOAT, 24, 12),
    ];

    let plotAttribs = [
      new PrimitiveAttribute('POSITION', this._plotVertexBuffer, 3, gl.FLOAT, 24, 0),
      new PrimitiveAttribute('COLOR_0', this._plotVertexBuffer, 3, gl.FLOAT, 24, 12),
    ];

    let plotAttribs2 = [
      new PrimitiveAttribute('POSITION', this._plotVertexBuffer2, 3, gl.FLOAT, 24, 0),
      new PrimitiveAttribute('COLOR_0', this._plotVertexBuffer2, 3, gl.FLOAT, 24, 12),
    ];

    let plotAttribs3 = [
      new PrimitiveAttribute('POSITION', this._plotVertexBuffer3, 3, gl.FLOAT, 24, 0),
      new PrimitiveAttribute('COLOR_0', this._plotVertexBuffer3, 3, gl.FLOAT, 24, 12),
    ];

    let plotPrimitive = new Primitive(plotAttribs, plotIndices.length,3); 
    let plotPrimitive2 = new Primitive(plotAttribs2, plotIndices2.length,3); 
    let plotPrimitive3 = new Primitive(plotAttribs3, plotIndices3.length,3); 
    let boardPrimitive = new Primitive(boardAttribs, boardIndices.length);

    boardPrimitive.setIndexBuffer(boardIndexBuffer);
    boardPrimitive.setBounds([-1.2, -1.2, 0.0], [1.2, 1.2, 0.015]);

    plotPrimitive.setIndexBuffer(plotIndexBuffer);
    plotPrimitive2.setIndexBuffer(plotIndexBuffer2);
    plotPrimitive3.setIndexBuffer(plotIndexBuffer3);

    plotPrimitive.setBounds([-1.2, -1.2, 0.0], [1.2, 1.2, 0.020]);
    plotPrimitive2.setBounds([-1.2, -1.2, 0.0], [1.2, 1.2, 0.020]);
    plotPrimitive3.setBounds([-1.2, -1.2, 0.0], [1.2, 1.2, 0.020]);

    this._boardRenderPrimitive = renderer.createRenderPrimitive(boardPrimitive, new StatsMaterial());
    this._plotPrimitive = renderer.createRenderPrimitive(plotPrimitive, new StatsMaterial());
    this._plotPrimitive2 = renderer.createRenderPrimitive(plotPrimitive2, new StatsMaterial());
    this._plotPrimitive3 = renderer.createRenderPrimitive(plotPrimitive3, new StatsMaterial());
    this._plotVertexBuffers= [this._plotVertexBuffer,this._plotVertexBuffer2,this._plotVertexBuffer3]

    this._boardNode = new Node();
    this._boardNode.addRenderPrimitive(this._boardRenderPrimitive);
    this._boardNode.addRenderPrimitive(this._plotPrimitive);
    this._boardNode.addRenderPrimitive(this._plotPrimitive2);
    this._boardNode.addRenderPrimitive(this._plotPrimitive3);
    this.addNode(this._boardNode);
  }

  //These are here for later integrating a button to start accelerating.
  begin() {
    this._startTime = now();
  }

  pause() {
    this._pauseTime = now();
  }

  unpause() {
    this._pauseTime = now() - this._pauseTime;
  }

  update() {
    let time = now();
    if (time > this._prevGraphUpdateTime) {
      this._acceleration = 0.1;
      this._time += 0.01
      this._velocity = this._acceleration*this._time;
      this._displacement += this._acceleration*(this._time)**2;
      this._times.push(this._time);
      this._displacements.push(this._displacement);
      this._velocities.push(this._velocity);
      this._accelerations.push(this._acceleration);

      let timeMax = findMax(this._time);
      let displacementMax = findMax(this._displacement);
      this._sevenSegmentNodes[0].text = `${displacementMax}`;
      this._sevenSegmentNodes[0].translation = [-0.925-0.05*(displacementMax.toString().length-1),0.9,0.015];
      this._sevenSegmentNodes[3].text = `${displacementMax}`;

      if (displacementMax.toString().length>3 & sizeKey===true)
      {
        this._sevenSegmentNodes[0].scale = [0.04,0.025,1];
        this._sevenSegmentNodes[3].scale = [0.025,0.025,1];
        sizeKey ===false;
      }
      let velocityMax = findMax(this._velocity);
      this._sevenSegmentNodes[1].text = `${velocityMax}`;
      this._sevenSegmentNodes[1].translation = [-0.625-0.05*(velocityMax.toString().length-1),0.9,0.015];
      this._sevenSegmentNodes[4].text = `${velocityMax}`;
      if (velocityMax.toString().length>3 & sizeKey2===true)
      {
        this._sevenSegmentNodes[1].scale = [0.04,0.025,1];
        this._sevenSegmentNodes[4].scale = [0.025,0.025,1];
        sizeKey2 ===false;
      }
      let accelerationMax = findMax(this._acceleration);
      this._sevenSegmentNodes[2].translation = [-0.325-0.05*(accelerationMax.toString().length-1),0.9,0.015];
      this._sevenSegmentNodes[2].text = `${accelerationMax}`;
      this._sevenSegmentNodes[5].text = `${accelerationMax}`;
      if (accelerationMax.toString().length>3 & sizeKey3===true)
      {
        this._sevenSegmentNodes[2].scale = [0.04,0.025,1];
        this._sevenSegmentNodes[5].scale = [0.025,0.025,1];
        sizeKey3 ===false;
      }

      if (timeMax !== this._timeMax | displacementMax !== this._displacementMax)
      {
        //instead of erasing all values, save the displacement values and find the new ones with the new max values.
         graphValues = [];
         for(let i=0; i<= this._displacements.length; i++)
         {
          graphValues.push(valuesToGraph(0,this._displacements[i],displacementMax,this._times[i],timeMax));
         }
      }

      if (timeMax !== this._timeMax | this._velocityMax !== velocityMax)
      {
        //instead of erasing all values, save the displacement values and find the new ones with the new max values.
         graphValues2 = [];
         for(let i=0; i<= this._velocities.length; i++)
         {
          graphValues2.push(valuesToGraph(1,this._velocities[i],velocityMax,this._times[i],timeMax));
         }
      }

      if (timeMax !== this._timeMax | this._accelerationMax !== accelerationMax)
      {
        //instead of erasing all values, save the displacement values and find the new ones with the new max values.
         graphValues3 = [];
         for(let i=0; i<= this._accelerations.length; i++)
         {
          graphValues3.push(valuesToGraph(2,this._accelerations[i],accelerationMax,this._times[i],timeMax));
         }
      }

      this._timeMax = timeMax;
      this._displacementMax = displacementMax;
      this._velocityMax = velocityMax;
      this._accelerationMax = accelerationMax;

      graphValues.push( valuesToGraph(0,this._displacement,this._displacementMax,this._time,this._timeMax) );
      graphValues2.push( valuesToGraph(1,this._velocity,this._velocityMax,this._time,this._timeMax) );
      graphValues3.push( valuesToGraph(2,this._acceleration,this._accelerationMax,this._time,this._timeMax) );

      let barValue = valuesToBar(this._displacement,this._displacementMax);
      let barValue2 = valuesToBar(this._velocity,this._velocityMax);
      let barValue3 = valuesToBar(this._acceleration,this._accelerationMax);

      this._updateProperties(0,barValue,graphValues);
      this._updateProperties(1,barValue2,graphValues2);
      this._updateProperties(2,barValue3,graphValues3);
      this._prevGraphUpdateTime = time;
    }
  }

  getDisplacement()
  {
    return this._displacement;
  }

  //This will simulate a button throttle. 
  _accelerate(a)
  {
    this.unpause();
    this._simulationTime = now()-this._startTime-this._pauseTime;
  }

  _stop()
  {
    this.pause();
  }

  //check if max changed before clearing 
  _clearPlot(n)
  {

  }

  _clearBar(n)
  {
    
  }

  _updateProperties(n,barValue,graphValues) {
    let updateVerts = [
      this._barStart + n * this._barSpacing,barValue, 0.02, 0.0, 1.0, 0.0,
      this._barStart + this._barWidth + n * this._barSpacing,barValue, 0.02, 0.0, 1.0, 0.0,
      this._barStart + n * this._barSpacing,-0.90, 0.02, 0.0, 1.0, 0.0,
      this._barStart + this._barWidth + n * this._barSpacing, -0.90, 0.02, 0.0, 1.0, 0.0
      ];
    this._renderer.updateRenderBuffer(this._boardVertexBuffer, new Float32Array(updateVerts), n * 24 * 4);
      let updatePlots = [];
      for (let i=0; i < graphValues.length; i++)
      {
        if (i===0)
        {
          updatePlots = [[
            graphHorStart + n* graphSpacing, graphValues[0][1], 0.02, 1.0, 1.0, 1.0,
            graphValues[0][0], graphValues[0][1], 0.02, 1.0, 1.0, 1.0,
            graphHorStart + n* graphSpacing, 0.0, 0.02, 1.0, 1.0, 1.0,
            graphValues[0][0], 0.0, 0.02, 1.0, 1.0, 1.0
          ]];
        }
         else if (i === graphValues.length-1 && i !== 0)
         {
           updatePlots.push([
             graphValues[i-1][0], graphValues[i][1], 0.0, 0.0, 0.0, 0.125,
             graphValues[i][0], graphValues[i][1], 0.0, 0.0, 0.0, 0.125,
             graphValues[i-1][0], graphValues[i-1][1], 0.0, 0.0, 0.0, 0.125,
             graphValues[i][0], graphValues[i-1][1], 0.0, 0.0, 0.0, 0.125
               ])
         }
         else {
               updatePlots.push([
             graphValues[i-1][0], graphValues[i][1], 0.02, 1.0, 1.0, 1.0,
             graphValues[i][0], graphValues[i][1], 0.02, 1.0, 1.0, 1.0,
             graphValues[i-1][0], graphValues[i-1][1], 0.02, 1.0, 1.0, 1.0,
             graphValues[i][0], graphValues[i-1][1], 0.02, 1.0, 1.0, 1.0
               ])
           }
         this._renderer.updateRenderBuffer(this._plotVertexBuffers[n], new Float32Array(updatePlots[i]),
         (i*24*4));
      } 
  }
}