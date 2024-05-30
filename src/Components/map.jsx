import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import roaddata from './contour_data.json';

// Import your custom marker image
import customMarkerImage from './pin_blue_50.png';

const MapComponent = () => {
    const [leafletMap, setLeafletMap] = useState(null);
    const [buildingData, setBuildingData] = useState([]);

    useEffect(() => {
        const map = L.map('map').setView([51.5072, 0.01276], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

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
                const area = latDifference * lonDifference * 111000 * 111000;
                return area;
            };

            const calculateCenterAndRadius = (south, west, north, east) => {
                const centerLatitude = (south + north) / 2;
                const centerLongitude = (west + east) / 2;
                const radius = 3000;
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
                const area = calculateArea(south, west, north, east);

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

                    fetch('http://overpass-api.de/api/interpreter', {
                        method: 'POST',
                        body: query
                    })
                        .then(response => response.json())
                        .then(data => {
                            setBuildingData(extractBuildingInfo(data));
                        })
                        .catch(error => console.error('Error fetching building data:', error));

                } else {
                    setBuildingData([]);
                    leafletMap.eachLayer(layer => {
                        if (layer instanceof L.Polygon) {
                            leafletMap.removeLayer(layer);
                        }
                    });
                }
            }

            calc_building();

            leafletMap.on('zoomend', calc_building);
            leafletMap.on('moveend', calc_building);
        }
    }, [leafletMap]);

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
            const road_coordinates = [];
            console.log("roaddata", roaddata);
            roaddata.forEach(road_coord => {
                let closestPoint = null;
                let minDistance = Infinity;
            
                buildingData.forEach(element => {
                    element.polygon.forEach(polygondata => {
                        const distance = haversineDistance(road_coord, polygondata);
                        if (distance < minDistance && !road_coordinates.some(coord => coord.lat === polygondata.lat && coord.lng === polygondata.lng)) {
                            minDistance = distance;
                            closestPoint = polygondata;
                            console.log("closest", closestPoint);
                        }
                    });
                });
            
                if (closestPoint) {
                    road_coordinates.push(closestPoint);
                }
            });

            // Define the custom icon
            const customIcon = L.icon({
                iconUrl: customMarkerImage,
                iconSize: [32, 32], // Adjust the size to your needs
                iconAnchor: [16, 32], // Point of the icon which will correspond to marker's location
                popupAnchor: [0, -32] // Point from which the popup should open relative to the iconAnchor
            });
            console.log(road_coordinates);
            road_coordinates.forEach(coordPair => {
                console.log(coordPair);
                // if (coordPair[1]) {
                    // L.polyline(coordPair, { color: 'blue' }).addTo(leafletMap);

                    // Add marker for each coordinate pair with custom icon
                    // L.marker(coordPair[0], { icon: customIcon }).addTo(leafletMap);
                    L.marker(coordPair, { icon: customIcon }).addTo(leafletMap);
                // }
            });
        }
    }, [leafletMap, buildingData]);

    return <div id="map" style={{ height: '700px', width: '100%' }}></div>;
};

export default MapComponent;
