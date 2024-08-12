import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import reindeer from './reindeer.json';
import father_christmas from './Father_Christmas.json';
import { Button, Input } from 'antd';
import '../index.css';

// Import your custom marker image
import customMarkerImage from './pin_blue_50.png';

const MapComponent = () => {
    const [leafletMap, setLeafletMap] = useState(null);
    const [buildingData, setBuildingData] = useState([]);
    const [mapShape, setMapShape] = useState('reindeer');
    const [zipCode, setZipCode] = useState('');
    const [centralcoord, setCentralCoord] = useState([51.479156, -0.082581]);
    const markersRef = useRef([]);
    const polylineRef = useRef(null);

    useEffect(() => {
        const map = L.map('map').setView(centralcoord, 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        setLeafletMap(map);
    }, []);

    const handleShapeChrismtmas = () => {
        setMapShape('father_christmas');
    };

    const handleShapeReindeer = () => {
        setMapShape('reindeer');
    };

    const [leftdown, setLeftDown] = useState([]);
    
    useEffect(() => {
        if (leafletMap) {
            const updateBounds = () => {
                const bounds = leafletMap.getBounds();
                const south = bounds.getSouth();
                const west = bounds.getWest();
                const north = bounds.getNorth();
                const east = bounds.getEast();
                return { south, west, north, east };
            };

            const calculateArea = (south, west, north, east) => {
                const latDifference = north - south;
                const lonDifference = east - west;
                const area = latDifference * lonDifference * 111000 * 111000;
                return area;
            };

            const calculateCenterAndRadius = (south, west, north, east) => {
                const centerLatitude = (south + north) / 2;
                const centerLongitude = (west + east) / 2;
                const radius = 2000;
                setLeftDown([centerLatitude - 0.01, centerLongitude - 0.001]);
                return { latitude: centerLatitude, longitude: centerLongitude, radius };
            };

            const extractBuildingInfo = (data) => {
                const buildingData = [];

                data.elements.forEach((element) => {
                    if (element.tags && element.tags.highway && element.nodes) {
                        const nodeIds = element.nodes;
                        const nodes = nodeIds.map((nodeId) => {
                            const node = data.elements.find((el) => el.id === nodeId);
                            if (node) {
                                return { lat: node.lat, lon: node.lon };
                            }
                            return null;
                        }).filter((node) => node !== null);

                        if (nodes.length > 0) {
                            const buildingPolygon = nodes.map(({ lat, lon }) => [lat, lon]);
                            const buildingType = element.tags.building || 'unknown';
                            buildingData.push({ type: buildingType, polygon: buildingPolygon });
                        }
                    }
                });

                return buildingData;
            };

            const calc_building = () => {
                const { south, west, north, east } = updateBounds();
                const overpassQuery = (south, west, north, east) => {
                    const { latitude, longitude, radius } = calculateCenterAndRadius(south, west, north, east);

                    return `
                        [out:json];
                        (
                            node["highway"](around:${radius},${latitude},${longitude});
                            way["highway"](around:${radius},${latitude},${longitude});
                            relation["highway"](around:${radius},${latitude},${longitude});
                        );
                        out body;
                        >;
                        out skel qt;
                    `;
                };

                const query = overpassQuery(south, west, north, east);

                fetch('http://overpass-api.de/api/interpreter', {
                    method: 'POST',
                    body: query
                })
                .then(response => response.json())
                .then(data => {
                    setBuildingData(extractBuildingInfo(data));
                })
                .catch(error => console.error('Error fetching building data:', error));
            }

            calc_building();

            // leafletMap.on('zoomend', calc_building);
            // leafletMap.on('moveend', calc_building);
        }
    }, [leafletMap, centralcoord]);

    class Graph {
        constructor() {
            this.nodes = new Map();
        }
        
        addNode(coordinate) {
            this.nodes.set(coordinate.toString(), []);
        }
        
        addEdge(start, end) {
            this.nodes.get(start.toString()).push(end);
            this.nodes.get(end.toString()).push(start); // Assuming bidirectional roads
        }
        
        getNeighbors(coordinate) {
            return this.nodes.get(coordinate.toString());
        }
    }
      
    const haversineDistance = (coord1, coord2) => {
        const toRad = (value) => (value * Math.PI) / 180;
        
        const [lat1, lon1] = coord1;
        const [lat2, lon2] = coord2;
      
        const R = 6371; // Earth radius in km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
        return R * c;
    };
      
    const coordToString = (coord) => `${coord[0]},${coord[1]}`;
    const stringToCoord = (str) => str.split(',').map(Number);
      
    const dijkstra = (graph, start, end) => {
        const startStr = coordToString(start);
        const endStr = coordToString(end);
      
        const distances = new Map();
        const previous = new Map();
        const queue = new PriorityQueue();
      
        distances.set(startStr, 0);
        queue.enqueue(startStr, 0);
      
        graph.nodes.forEach((_, node) => {
          if (node !== startStr) {
            distances.set(node, Infinity);
          }
          previous.set(node, null);
        });
      
        while (!queue.isEmpty()) {
          const smallest = queue.dequeue();
      
          if (smallest === endStr) {
            const path = [];
            let currentNode = endStr;
            while (currentNode) {
              path.unshift(stringToCoord(currentNode));
              currentNode = previous.get(currentNode);
            }
            return path;
          }
      
          graph.getNeighbors(stringToCoord(smallest)).forEach(neighbor => {
            const neighborStr = coordToString(neighbor);
            const alt = distances.get(smallest) + haversineDistance(stringToCoord(smallest), neighbor);
            if (alt < distances.get(neighborStr)) {
              distances.set(neighborStr, alt);
              previous.set(neighborStr, smallest);
              queue.enqueue(neighborStr, alt);
            }
          });
        }
      
        return [];
    };
      
    class PriorityQueue {
        constructor() {
          this.values = [];
        }
      
        enqueue(val, priority) {
          this.values.push({ val, priority });
          this.sort();
        }
      
        dequeue() {
          return this.values.shift().val;
        }
      
        isEmpty() {
          return this.values.length === 0;
        }
      
        sort() {
          this.values.sort((a, b) => a.priority - b.priority);
        }
    }
      
      // Graph creation function remains the same
      
    const createGraph = (buildingData) => {
        const graph = new Graph();
        
        buildingData.forEach(road => {
          const points = road.polygon;
          points.forEach((point, index) => {
            graph.addNode(point);
            if (index > 0) {
              graph.addEdge(points[index - 1], point);
            }
          });
        });
      
        return graph;
    };
    
    const graph = createGraph(buildingData);
      
    const findNearestNeighbor = (points, startPoint) => {
        const sortedPoints = [startPoint];
        const remainingPoints = [...points];
        remainingPoints.splice(remainingPoints.indexOf(startPoint), 1);
        let maxdistance = 0.0;

        while (remainingPoints.length) {
            const lastPoint = sortedPoints[sortedPoints.length - 1];
            let nearestIndex = 0;
            let nearestDistance = Infinity;

            for (let i = 0; i < remainingPoints.length; i++) {
                const distance = Math.sqrt(
                    Math.pow(lastPoint[0] - remainingPoints[i][0], 2) +
                    Math.pow(lastPoint[1] - remainingPoints[i][1], 2)
                );

                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = i;
                }
                if(maxdistance < distance) {
                    maxdistance = distance;
                }
            }
            // let over_value = sortedPoints[sortedPoints.length - 1];

            sortedPoints.push(remainingPoints[nearestIndex]);
            remainingPoints.splice(nearestIndex, 1);
        }
        sortedPoints.push(startPoint)

        return sortedPoints;
    };

    useEffect(() => {
        if (leafletMap && buildingData.length > 0) {
            markersRef.current.forEach(marker => {
                leafletMap.removeLayer(marker);
            });
            markersRef.current = [];

            const roaddata = mapShape === 'reindeer' ? reindeer : father_christmas;
            const linepoints = [];
            const closest_points = [];
            const original_points = [];
            const check_point = {};
            let buildingpoints = []


            roaddata.forEach(road_coord => {
                // Calculate the current road coordinate
                const currentRoadCoord = [leftdown[0] + road_coord[0] / 40000, leftdown[1] + road_coord[1] / 25000];
                original_points.push(currentRoadCoord);
                let minDistance = Infinity;
                let closestPoint = null;
                let twopoints = []
                let linepoint = null;
                // Find the closest point in buildingData
                let iii = 1;
                buildingData.forEach(element => {
                    if (element.polygon) {
                        buildingpoints.push(element.polygon);
                        if(iii > 1000){
                            return;
                        }
                        iii += 1;
                        let firstPoint = element.polygon[0];
                        let lastPoint = element.polygon[element.polygon.length - 1];
                        
                        let pointsToCheck = [firstPoint, lastPoint];
                        
                        // element.polygon.forEach(polygondata => {
                        //     let distance = Math.sqrt(Math.pow(currentRoadCoord[0] - polygondata[0], 2) + Math.pow(currentRoadCoord[1] - polygondata[1], 2));
                        //     if (distance < minDistance) {
                        //         minDistance = distance;
                        //         closestPoint = polygondata;
                        //         linepoint = [element.polygon[0], polygondata];
                        //     }
                        // });
                        // pointsToCheck.forEach(polygondata => {
                        //     let distance = Math.sqrt(Math.pow(currentRoadCoord[0] - polygondata[0], 2) + Math.pow(currentRoadCoord[1] - polygondata[1], 2));
                        //     if (distance < minDistance) {
                        //         twopoints = element.polygon;
                        //     }
                        // });
                    }
                });
                const pointKey = JSON.stringify(closestPoint);
                linepoints.push(twopoints);

                // Add the closest point to closest_points
                if (closestPoint && !check_point[pointKey]) {
                    closest_points.push(closestPoint);
                    check_point[pointKey] = true; // Mark the point as checked
                    // polylineRef.current = L.polyline(twopoints, { color: 'red' }).addTo(leafletMap);
                }
            });
            // closest_points.forEach(coordPair => {
            //     const marker = L.marker(coordPair, { icon: customIcon }).addTo(leafletMap);
            //     markersRef.current.push(marker);
            // });
            // console.log("closest_points", buildingData);
            // Sort the closest points using the nearest neighbor approach
            let sortedPoints = [];
            if (mapShape === 'father_christmas'){
                sortedPoints = findNearestNeighbor(closest_points, closest_points[0]);
                console.log('father_christmas');
            }
            closest_points.push(closest_points[0]);
            // Draw polyline between the sorted points
            if (polylineRef.current) {
                leafletMap.removeLayer(polylineRef.current);
            }

            const findConnections = (closest_points, graph) => {
                const connections = [];
              
                for (let i = 0; i < closest_points.length - 1; i++) {
                    let ii = 1;
                    while (i + ii < closest_points.length){
                        const start = closest_points[i];
                        const end = closest_points[i + ii];
                        const path = dijkstra(graph, start, end);
                        connections.push(path);
                        ii += 1;
                    }
                //   start = closest_points[i][closest_points[i].length - 1];
                //   end = closest_points[i + 1][closest_points[i + 1].length - 1];
                //   path = dijkstra(graph, start, end);
                //   connections.push(path);

                //   start = closest_points[i][0];
                //   end = closest_points[i + 1][0];
                //   path = dijkstra(graph, start, end);
                //   connections.push(path);

                //   start = closest_points[i][0];
                //   end = closest_points[i + 1][closest_points[i + 1].length - 1];
                //   path = dijkstra(graph, start, end);
                //   connections.push(path);
                }
              
                return connections;
            };

            // Sort function to sort by latitude first, then by longitude
            const sortClosestPoints = (a, b) => {
                if (a[0][0] === b[0][0]) {
                    return a[0][1] - b[0][1];
                }
                return a[0][0] - b[0][0];
            };
            console.log("close", closest_points);
            // Sorting the closest_points array
            // closest_points.sort(sortClosestPoints);

            const sample_road = [
                [
                    [
                        51.4760821,
                        -0.0698844
                    ],
                    [
                        51.4760302,
                        -0.0698521
                    ],
                    [
                        51.4759842,
                        -0.0698314
                    ],
                    [
                        51.4755551,
                        -0.0696858
                    ],
                    [
                        51.475346,
                        -0.0695938
                    ],
                    [
                        51.4753358,
                        -0.0696731
                    ]
                ],
                [
                    [
                        51.4874989,
                        -0.0755241
                    ],
                    [
                        51.4874626,
                        -0.075576
                    ],
                    [
                        51.4873196,
                        -0.0757805
                    ],
                    [
                        51.48701,
                        -0.0762234
                    ],
                    [
                        51.4863591,
                        -0.0763281
                    ],
                    [
                        51.4861418,
                        -0.076363
                    ],
                    [
                        51.4857598,
                        -0.0764143
                    ],
                    [
                        51.485583,
                        -0.076438
                    ],
                    [
                        51.4853827,
                        -0.0764949
                    ],
                    [
                        51.4850407,
                        -0.0765672
                    ],
                    [
                        51.4849548,
                        -0.0765794
                    ],
                    [
                        51.4848619,
                        -0.0766059
                    ],
                    [
                        51.4845406,
                        -0.0766933
                    ],
                    [
                        51.4842602,
                        -0.0767695
                    ],
                    [
                        51.484186,
                        -0.0767912
                    ],
                    [
                        51.4840389,
                        -0.0768173
                    ],
                    [
                        51.4835074,
                        -0.0769116
                    ],
                    [
                        51.4831792,
                        -0.0769698
                    ]
                ]
            ]

            const dis_road = [
                [],
                [],
                [
                    [
                        51.4831503,
                        -0.0770746
                    ],
                    [
                        51.4831647,
                        -0.0770522
                    ],
                    [
                        51.4831792,
                        -0.0769698
                    ]
                ]
            ]
            // Define the custom icon
            const customIcon = L.icon({
                iconUrl: customMarkerImage,
                iconSize: [16, 16], // Adjust the size to your needs
                iconAnchor: [16, 16], // Point of the icon which will correspond to marker's location
                popupAnchor: [0, -16] // Point from which the popup should open relative to the iconAnchor
            });

            // const connections = findConnections(closest_points, graph);
            // console.log(connections);
            // polylineRef.current = L.polyline(connections, { color: 'blue' }).addTo(leafletMap);
            // polylineRef.current = L.polyline(sample_road, { color: 'red' }).addTo(leafletMap);
            // closest_points.forEach(coordPair => {
            //     const marker = L.marker(coordPair, { icon: customIcon }).addTo(leafletMap);
            //     markersRef.current.push(marker);
            // });

            if (mapShape === 'father_christmas'){
                const maxDistance = 20;
                // const filteredPoints = sortedPoints.filter((point, index, array) => {
                //     if (index === 0) return true; // Always keep the first point
                //     const previousPoint = array[index - 1];
                //     const distance = L.latLng(point).distanceTo(previousPoint);
                //     return distance * 6371 <= maxDistance;
                // });

                // polylineRef.current = L.polyline(filteredPoints, { color: 'blue' }).addTo(leafletMap);
            }
            else {
                const maxDistance = 10;
                // const filteredPoints = closest_points.filter((point, index, array) => {
                //     if (index === 0) return true; // Always keep the first point
                //     const previousPoint = array[index - 1];
                //     const distance = L.latLng(point).distanceTo(previousPoint);
                //     return distance * 6371 <= maxDistance;
                // });

                // polylineRef.current = L.polyline(filteredPoints, { color: 'blue' }).addTo(leafletMap);

                // polylineRef.current = L.polyline(connections, { color: 'red' }).addTo(leafletMap);
                polylineRef.current = L.polyline(buildingpoints, { color: 'red' }).addTo(leafletMap);
            }
        }
    }, [leafletMap, buildingData, mapShape, centralcoord]);

    const handleZipCodeChange = (e) => {
        setZipCode(e.target.value);
    };

    const handleZipCodeSubmit = () => {
        if (zipCode) {
            fetch(`https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&format=json&addressdetails=1`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const { lat, lon } = data[0];
                        leafletMap.setView([parseFloat(lat), parseFloat(lon)], 15);
                        setCentralCoord([parseFloat(lat), parseFloat(lon)]);
                    } else {
                        console.error('No data found for the provided ZIP code');
                    }
                })
                .catch(error => console.error('Error fetching geocode data:', error));
        }
    };

    return (
        <>
            <div className="flex mt-2 mb-10 justify-between items-center">
                <h1 className="text-center font-momo text-6xl bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text animate-text"
                    style={{ marginLeft: 750 }}
                >Running Map</h1>
                <div className="items-center">
                    <div className="mr-5 my-5">
                        <label>ZIP Code</label>
                        <Input value={zipCode} onChange={handleZipCodeChange} />
                        <Button onClick={handleZipCodeSubmit} style={{color: '#ffffff', backgroundColor: '#0033cc', marginTop: '5px'}}>Search</Button>
                    </div>
                    <div>
                        <Button className=" mr-2.5" onClick={handleShapeChrismtmas} style={{color: '#ffffff', backgroundColor: '#0033cc'}}>
                            Father_Christmas
                        </Button>
                        <Button className="" onClick={handleShapeReindeer} style={{color: '#ffffff', backgroundColor: '#0033cc'}}>
                            reindeer
                        </Button>
                    </div>
                </div>
            </div>
            <div id="map" style={{ height: '700px', width: '100%' }}></div>
        </>
    );
};

export default MapComponent;
