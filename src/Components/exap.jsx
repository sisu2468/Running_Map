import React, { useEffect, useState } from 'react';
import L, { bounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapComponent = () => {
    const [leafletMap, setLeafletMap] = useState(null);
    const [buildingCoordinates, setBuildingCoordinates] = useState([]);
    const [buildingcount, setBuildingcount] = useState([])

    useEffect(() => {
        // Create Leaflet map
        const map = L.map('map').setView([41.233731, -80.92304], 15);

        // Add tile layer to the map
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Set the leafletMap state variable
        setLeafletMap(map);
    }, []);

    const south = '', east= '', west = '', north = '', area = ''
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
                if (area < 11042712){
                    const overpassQuery = `
                        [out:json];
                        (
                            way["building"](${south},${west},${north},${east});
                        );
                        out;
                    `;
                    // Fetch building data from Overpass API
                    fetch(`http://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`)
                        .then(response => response.json())
                        .then(data => {
                            // Extract building coordinates from the response
                            setBuildingcount(data.elements);
                            console.log("asdfas", data.elements);
                            const coordinates = data.elements
                                .filter(element => element.type === 'way' && element.tags.building)
                                .map(element => element.nodes.map(nodeId => [nodeId, element.id]))
                                .flat();
                            console.log("324234", coordinates.length);
                            // if(coordinates)
                            // Fetch coordinates for each node
                            
                            Promise.all(coordinates.map(([nodeId, wayId]) => 
                                fetch(`http://api.openstreetmap.org/api/0.6/node/${nodeId}`)
                                    .then(response => response.text())
                                    .then(position => {
                                        const parser = new DOMParser();
                                        const xmlDoc = parser.parseFromString(position, 'text/xml');
                                        const node = xmlDoc.querySelector('node');
                                        const lat = node.getAttribute('lat');
                                        const lon = node.getAttribute('lon');
                                        var newList = []
                                        newList = [...buildingCoordinates, lat, lon]
                                        return [lat, lon];
                                    })
                            )).then(lat_lon => {
                                setBuildingCoordinates(lat_lon);
                            });
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
        console.log(buildingCoordinates);
        var index = 0
        if(buildingCoordinates.length > 0){
            buildingcount.forEach(element => {
                var newarray = []
                element.nodes.forEach(pos => {
                    newarray.push(buildingCoordinates[index])
                    index = index + 1
                });
                L.polygon(newarray).addTo(leafletMap);
            });
        }
        // buildingcount.map((building, index) => {
        //     // buildingCoordinates.shift();
        //     console.log(building);
        // });
            // Add polygon layer to the map using buildingCoordinates
        // if(newarray.length)
        //     L.polygon(newarray).addTo(leafletMap);
    }, [leafletMap, buildingCoordinates]);

    return <div id="map" style={{ height: '500px', width: '100%' }}></div>;
};


export default MapComponent;
