import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import roaddata from './sorted_data.json';

const MapComponent = () => {
    const [leafletMap, setLeafletMap] = useState(null);
    const [buildingData, setBuildingData] = useState([]);

    useEffect(() => {
        // Create Leaflet map
        const map = L.map('map').setView([51.5072, 0.1276], 14);

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
                const radius = 3000; // This seems like a fixed value in your code
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

            const calc_building = () => {
                const { south, west, north, east } = updateBounds();
                const area = calculateArea(south, west, north, east);
                console.log("area", area);

                if (area < 1104271200000000) {
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

                } else {
                    setBuildingData([]);
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
            leafletMap.on('zoomend', calc_building);
            leafletMap.on('moveend', calc_building);
        }
    }, [leafletMap]);

    // Function to calculate the distance between two coordinates in kilometers
    const haversineDistance = (coords1, coords2) => {
        const toRadians = degrees => degrees * Math.PI / 180;

        const lat1 = coords1[0];
        const lon1 = coords1[1];
        const lat2 = coords2[0];
        const lon2 = coords2[1];

        const R = 6371; // Radius of the Earth in kilometers
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance;
    };

    useEffect(() => {
        if (leafletMap && buildingData.length > 0) {
            console.log("data", buildingData);
            const road_coordinates = [];

            roaddata.forEach(road_coord => {
                let closestPoint = null;
                let minDistance = Infinity;

                buildingData.forEach(element => {
                    element.polygon.forEach(polygondata => {
                        const distance = haversineDistance(road_coord, polygondata);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestPoint = polygondata;
                        }
                    });
                });
                road_coordinates.push([road_coord, closestPoint]);
            });

            console.log("road_coordinates", road_coordinates);

            // Draw lines using road_coordinates
            road_coordinates.forEach(coordPair => {
                console.log("coordPair", coordPair);
                if (coordPair[1]) {
                    L.polyline(coordPair, { color: 'blue' }).addTo(leafletMap);
                }
            });
        }
    }, [leafletMap, buildingData]);

    return <div id="map" style={{ height: '700px', width: '100%' }}></div>;
};

export default MapComponent;
