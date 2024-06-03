import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import reindeer from './reindeer.json';
import father_christmas from './Father_Christmas.json'

// Import your custom marker image
import customMarkerImage from './pin_blue_50.png';

const MapComponent = () => {
    const [leafletMap, setLeafletMap] = useState(null);
    const [buildingData, setBuildingData] = useState([]);
    const[mapshape, setMapShape] = useState('reindeer');
    const markersRef = useRef([]);


    useEffect(() => {
        const map = L.map('map').setView([51.48046624769113,  -0.06145477294921875], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        setLeafletMap(map);
    }, []);

    
    const handleShapeChrismtmas = () => {
        console.log("father");
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
                setLeftDown([south, west]);
                console.log("south", south, west, north, east);
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
                const radius = 1000;
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

    useEffect(() => {
        if (leafletMap && buildingData.length > 0) {
            markersRef.current.forEach(marker => {
                leafletMap.removeLayer(marker);
            });
            markersRef.current = [];

            const road_coordinates = [];
            const roaddata = mapshape ==='reindeer' ? reindeer : father_christmas;
            console.log(leftdown); 
            roaddata.forEach(road_coord => {

                road_coordinates.push([leftdown[0] + road_coord[0]/9000, leftdown[1] +  road_coord[1]/2000]);
            
                // buildingData.forEach(element => {
                //     element.polygon.forEach(polygondata => {
                //     });
                // });
            });

            // Define the custom icon
            const customIcon = L.icon({
                iconUrl: customMarkerImage,
                iconSize: [16, 16], // Adjust the size to your needs
                iconAnchor: [16, 16], // Point of the icon which will correspond to marker's location
                popupAnchor: [0, -16] // Point from which the popup should open relative to the iconAnchor
            });
            road_coordinates.forEach(coordPair => {
                const marker = L.marker(coordPair, { icon: customIcon }).addTo(leafletMap);
                markersRef.current.push(marker);
            });
        }
    }, [leafletMap, buildingData, mapshape]);

    return (
        <>
            <div id="map" style={{ height: '700px', width: '100%' }}></div>
            <button className='btn btn-primary' onClick={handleShapeChrismtmas}>Father_Christmas</button>
            <button className='btn btn-primary' onClick={handleShapeReindeer}>reindeer</button>
        </>
    )
};

export default MapComponent;
