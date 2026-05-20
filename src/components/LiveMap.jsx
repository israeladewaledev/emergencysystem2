"use client";
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet + React
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const RecenterMap = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

const LiveMap = ({ latitude, longitude, label = "User Location" }) => {
  const position = [latitude || 9.0435, longitude || 7.4111]; // Default to Nile University coordinates

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner border border-gray-100">
      <MapContainer
        key={`${position[0]}-${position[1]}`} // Force remount on location change to prevent "Map container is being reused" error
        center={position}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>
            <div className="text-xs font-bold">{label}</div>
          </Popup>
        </Marker>
        <RecenterMap center={position} />
      </MapContainer>
    </div>
  );
};

export default LiveMap;
