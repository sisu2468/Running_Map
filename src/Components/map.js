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
    const [centralcoord, setCentralCoord] = useState([51.47046624769113, -0.06145477294921875]);
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

    const findNearestNeighbor = (points, startPoint) => {
        const sortedPoints = [startPoint];
        const remainingPoints = [...points];
        remainingPoints.splice(remainingPoints.indexOf(startPoint), 1);

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
            }

            sortedPoints.push(remainingPoints[nearestIndex]);
            remainingPoints.splice(nearestIndex, 1);
        }

        return sortedPoints;
    };

    useEffect(() => {
        if (leafletMap && buildingData.length > 0) {
            markersRef.current.forEach(marker => {
                leafletMap.removeLayer(marker);
            });
            markersRef.current = [];

            const roaddata = mapShape === 'reindeer' ? reindeer : father_christmas;
            const road_coordinates = [];
            const closest_points = [];
            const original_points = [];

            roaddata.forEach(road_coord => {
                // Calculate the current road coordinate
                const currentRoadCoord = [leftdown[0] + road_coord[0] / 40000, leftdown[1] + road_coord[1] / 25000];
                original_points.push(currentRoadCoord);
                let minDistance = Infinity;
                let closestPoint = null;

                // Find the closest point in buildingData
                buildingData.forEach(element => {
                    if (element.polygon) {
                      element.polygon.forEach(polygondata => {
                          let distance = Math.sqrt(Math.pow(currentRoadCoord[0] - polygondata[0], 2) + Math.pow(currentRoadCoord[1] - polygondata[1], 2));
                          if (distance < minDistance) {
                              minDistance = distance;
                              closestPoint = polygondata;
                          }
                      });
                    }
                });

                // Add the closest point to closest_points
                if (closestPoint) {
                    closest_points.push(closestPoint);
                }
            });

            // Define the custom icon
            const customIcon = L.icon({
                iconUrl: customMarkerImage,
                iconSize: [16, 16], // Adjust the size to your needs
                iconAnchor: [16, 16], // Point of the icon which will correspond to marker's location
                popupAnchor: [0, -16] // Point from which the popup should open relative to the iconAnchor
            });

            // closest_points.forEach(coordPair => {
            //     const marker = L.marker(coordPair, { icon: customIcon }).addTo(leafletMap);
            //     markersRef.current.push(marker);
            // });

            // Sort the closest points using the nearest neighbor approach
            const sortedPoints = findNearestNeighbor(closest_points, closest_points[0]);

            // Draw polyline between the sorted points
            if (polylineRef.current) {
                leafletMap.removeLayer(polylineRef.current);
            }

            polylineRef.current = L.polyline(sortedPoints, { color: 'blue' }).addTo(leafletMap);
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
                >
                    Running Map
                </h1>
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
