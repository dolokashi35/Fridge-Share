import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function LocationPicker({ value, onChange }) {
  const [position, setPosition] = useState(value || { lat: 37.8715, lng: -122.2730 }); // Default: Berkeley

  function LocationMarker() {
    useMapEvents({
      click(e) {
        setPosition(e.latlng);
        onChange && onChange(e.latlng);
      },
    });
    return position ? <Marker position={position} /> : null;
  }

  return (
    <div style={{ margin: '1rem 0' }}>
      <MapContainer center={position} zoom={14} style={{ height: 200, width: '100%', borderRadius: 10 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker />
      </MapContainer>
      <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
        Click on the map to set pickup location.
      </div>
      {position && (
        <div style={{ fontSize: 13, color: '#555' }}>
          Lat: {position.lat.toFixed(5)}, Lng: {position.lng.toFixed(5)}
        </div>
      )}
    </div>
  );
}
