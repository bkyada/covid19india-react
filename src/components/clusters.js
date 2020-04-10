import axios from 'axios';
import * as d3 from 'd3';
import React, {useEffect, useRef, useState} from 'react';

function Clusters(props) {
  const [fetched, setFetched] = useState(false);
  const [networkData, setNetworkData] = useState([]);
  const svgRef = useRef();

  function prepareNetworkData(rawData) {
    // Parse data
    let contractedStr = rawData.reduce(
      (acc, v) => acc + v.contractedfromwhichpatientsuspected + ', ',
      ''
    );
    contractedStr = contractedStr.replace(/\s+/g, '');
    const sources = new Set(contractedStr.match(/[^,]+/g));

    // Prepare nodes and links
    const nodes = [];
    const nodesSet = new Set();
    const links = [];
    rawData.forEach((d) => {
      const contractedStr = d.contractedfromwhichpatientsuspected.replace(
        /\s+/g,
        ''
      );
      const contracted = contractedStr.match(/[^,]+/g);
      if (contracted) {
        const pid = 'P' + d.patientnumber;
        nodesSet.add(pid);
        nodes.push({
          id: pid,
          group: sources.has(pid) ? 'source' : 'target',
        });
        contracted.forEach((p) => {
          links.push({
            source: p,
            target: pid,
          });
        });
      }
    });

    // Add missing nodes
    links.forEach((d) => {
      if (!nodesSet.has(d.source)) {
        nodes.push({
          id: d.source,
          group: 'source',
        });
        nodesSet.add(d.source);
      }
    });
    return {
      nodes: nodes,
      links: links,
    };
  }

  useEffect(() => {
    async function getData() {
      try {
        const rawDataResponse = await axios.get(
          'https://api.covid19india.org/raw_data.json'
        );
        setNetworkData(prepareNetworkData(rawDataResponse.data.raw_data));
        setFetched(true);
      } catch (err) {
        console.log(err);
      }
    }
    if (!fetched) {
      getData();
    }
  }, [fetched]);

  const drag = (simulation) => {
    function dragstarted(d) {
      if (!d3.event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }

    function dragended(d) {
      if (!d3.event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3
      .drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  };

  useEffect(() => {
    if (!fetched) return;
    const svg = d3.select(svgRef.current);
    const width = +svg.attr('width');
    const height = +svg.attr('height');
    svg.attr('viewBox', [-width / 2, -height / 2, width, height]);

    const colorScale = d3
      .scaleOrdinal(d3.schemeCategory10)
      .domain(['target', 'source']);
    const radius = 4;

    // Network graph
    const nodes = networkData.nodes.map((d) => Object.create(d));
    const links = networkData.links.map((d) => Object.create(d));

    // Custom force to keep everything inside box
    function boxForce() {
      for (let i = 0, n = nodes.length; i < n; ++i) {
        const currNode = nodes[i];
        currNode.x = Math.max(
          -width / 2 + radius,
          Math.min(width / 2 - radius, currNode.x)
        );
        currNode.y = Math.max(
          -height / 2 + radius,
          Math.min(height / 2 - radius, currNode.y)
        );
      }
    }

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3.forceLink(links).id((d) => d.id)
      )
      .force('charge', d3.forceManyBody())
      .force('x', d3.forceX().strength(0.3))
      .force('y', d3.forceY().strength(0.3))
      .force('boxForce', boxForce);

    const link = svg
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', (d) => Math.sqrt(d.value));

    const node = svg
      .append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', radius)
      .attr('fill', (d) => colorScale(d.group))
      .call(drag(simulation));

    node.append('title').text((d) => d.id);

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);

      node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
    });
  }, [fetched, networkData]);

  return (
    <div className="Clusters">
      <svg id="clusters" width="1280" height="720" ref={svgRef}></svg>
    </div>
  );
}

export default Clusters;
