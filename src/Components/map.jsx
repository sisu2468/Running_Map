import React, { useEffect, useState } from 'react';
import L, { bounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapComponent = () => {
    const [leafletMap, setLeafletMap] = useState(null);
    const [buildingCoordinates, setBuildingCoordinates] = useState([]);
    const [buildingcount, setBuildingcount] = useState([])
    const [buildingData, setBuildingData] = useState([])

    useEffect(() => {
        // Create Leaflet map51.5072° N, 0.1276
        const map = L.map('map').setView([51.5072,0.1276], 17);

        // Add tile layer to the map
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Set the leafletMap state variable
        setLeafletMap(map);
    }, []);

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
                const area = latDifference * lonDifference * 111000 * 111000; // Convert to square meters
                return area;
            };
            const calc_building = () => {
                const { south, west, north, east } = updateBounds();
                const area = calculateArea(south, west, north, east);
                console.log("area", area);
                const calculateCenterAndRadius = (south, west, north, east) => {
                    // Calculate the center latitude and longitude
                    const centerLatitude = (south + north) / 2;
                    const centerLongitude = (west + east) / 2;
                
                    // Calculate the radius (distance from center to corner)
                    const earthRadius = 6371000; // Earth's radius in meters
                    const dLat = Math.abs(north - south);
                    const dLon = Math.abs(east - west);
                    const dLatMeters = dLat * earthRadius * Math.PI / 180;
                    const dLonMeters = dLon * earthRadius * Math.PI / 180;
                    const radius = 1000;
                    console.log("radius", radius);
                    return { latitude: centerLatitude, longitude: centerLongitude, radius: radius };
                };
                const extractBuildingInfo = (data) => {
                    const buildingData = [];
                
                    data.elements.forEach((element) => {
                        if (element.tags && element.tags.highway && element.nodes) {
                            const nodeIds = element.nodes;
                            // Retrieve latitude and longitude coordinates of each node
                            const nodes = nodeIds.map((nodeId) => {
                                const node = data.elements.find((el) => el.id === nodeId);
                                if (node) {
                                    return { lat: node.lat, lon: node.lon };
                                }
                                return null;
                            }).filter((node) => node !== null);
                
                            if (nodes.length > 0) {
                                // Construct a Polygon from the nodes
                                const buildingPolygon = nodes.map(({ lat, lon }) => [lat, lon]);
                                const buildingType = element.tags.building || 'unknown';
                                buildingData.push({ type: buildingType, polygon: buildingPolygon });
                            }
                        }
                    });
                
                    return buildingData;
                };
                if (area < 110427120000){
                    const overpassQuery = (south, west, north, east) => {
                        const { latitude, longitude, radius } = calculateCenterAndRadius(south, west, north, east);
            
                        return `
                            [out:json];
                            (
                                node["building"](around:${radius},${latitude},${longitude});
                                way["building"](around:${radius},${latitude},${longitude});
                                relation["building"](around:${radius},${latitude},${longitude});
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

                    // Now you can use this query in your fetch request
                    fetch('http://overpass-api.de/api/interpreter', {
                        method: 'POST',
                        body: query
                    })
                    .then(response => response.json())
                    .then(data => {
                        setBuildingData(extractBuildingInfo(data));
                        console.log("road", data)
                    })
                    .catch(error => console.error('Error fetching building data:', error));
                    
                }
                else {
                    setBuildingCoordinates([]);
                    // Remove existing polygons from the map
                    leafletMap.eachLayer(layer => {
                        if (layer instanceof L.Polygon) {
                            leafletMap.removeLayer(layer);
                        }
                    });
                }
            }
            calc_building();

            // Listen for map events
            if (leafletMap) {
                leafletMap.on('zoomend', calc_building);
                leafletMap.on('moveend', calc_building);
            }
        }
    }, [leafletMap]);
    useEffect(() => {
        console.log("data", buildingData);
        buildingData.forEach(element => {
            // console.log("result", element.polygon);
            L.polygon(element.polygon).addTo(leafletMap);
        });
    }, [leafletMap, buildingData]);

    return <div id="map" style={{ height: '500px', width: '100%' }}></div>;
};


export default MapComponent;
