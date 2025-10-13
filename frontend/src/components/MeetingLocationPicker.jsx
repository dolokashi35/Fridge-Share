import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MeetingLocationPicker.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Pre-defined safe zones (college campus locations)
const SAFE_ZONES = [
  { id: 'dorm-kitchen-1', name: 'McCarty Hall Kitchen', coordinates: [40.1020, -88.2272], type: 'kitchen' },
  { id: 'dorm-kitchen-2', name: 'Wassaja Hall Kitchen', coordinates: [40.1015, -88.2265], type: 'kitchen' },
  { id: 'dorm-lounge-1', name: 'Bousfield Hall Lounge', coordinates: [40.1018, -88.2268], type: 'lounge' },
  { id: 'dorm-lounge-2', name: 'Hopkins Hall Lounge', coordinates: [40.1022, -88.2275], type: 'lounge' },
  { id: 'campus-center', name: 'Student Union Food Court', coordinates: [40.1010, -88.2260], type: 'food-court' },
  { id: 'library-entrance', name: 'Main Library Entrance', coordinates: [40.1012, -88.2262], type: 'library' },
  { id: 'gym-lobby', name: 'Campus Recreation Lobby', coordinates: [40.1008, -88.2258], type: 'recreation' },
  { id: 'coffee-shop', name: 'Starbucks Campus', coordinates: [40.1005, -88.2255], type: 'coffee' }
];

// Custom marker icons for different types
const getMarkerIcon = (type) => {
  const colors = {
    kitchen: '#4CAF50',    // Green
    lounge: '#2196F3',     // Blue
    'food-court': '#FF9800', // Orange
    library: '#9C27B0',    // Purple
    recreation: '#F44336',  // Red
    coffee: '#795548',     // Brown
    custom: '#607D8B'      // Blue Grey
  };
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${colors[type] || colors.custom};" class="safe-zone-marker"></div>`,
    iconSize: [25, 25],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

// Component to handle map interactions
function MapController({ onLocationSelect, selectedLocation, userLocation }) {
  const map = useMap();
  
  useEffect(() => {
    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng;
      onLocationSelect({
        id: 'custom',
        name: 'Custom Location',
        coordinates: [lat, lng],
        type: 'custom'
      });
    };
    
    map.on('click', handleMapClick);
    return () => map.off('click', handleMapClick);
  }, [map, onLocationSelect]);
  
  return null;
}

export default function MeetingLocationPicker({ 
  isOpen, 
  onClose, 
  onLocationConfirm, 
  userLocation,
  currentLocation = null 
}) {
  const [selectedLocation, setSelectedLocation] = useState(currentLocation);
  const [mapCenter, setMapCenter] = useState(userLocation || [40.1015, -88.2265]);
  const mapRef = useRef(null);

  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
    }
  }, [userLocation]);

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
  };

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const customLocation = {
            id: 'my-location',
            name: 'My Current Location',
            coordinates: [latitude, longitude],
            type: 'custom'
          };
          setSelectedLocation(customLocation);
          setMapCenter([latitude, longitude]);
        },
        (err) => {
          console.error('Error getting location:', err);
          alert('Failed to get your location. Please enable location services.');
        }
      );
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationConfirm(selectedLocation);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="meeting-location-picker-overlay">
      <div className="meeting-location-picker-content">
        <div className="picker-header">
          <h3>📍 Choose Meeting Location</h3>
          <button onClick={onClose} className="close-picker-btn">&times;</button>
        </div>
        
        <div className="picker-instructions">
          <p>Tap a safe zone pin or click anywhere on the map to set a custom location.</p>
        </div>

        <div className="map-container-wrapper">
          <MapContainer
            center={mapCenter}
            zoom={16}
            whenCreated={mapInstance => { mapRef.current = mapInstance; }}
            className="meeting-map-container"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapController 
              onLocationSelect={handleLocationSelect}
              selectedLocation={selectedLocation}
              userLocation={userLocation}
            />
            
            {/* User's current location */}
            {userLocation && (
              <Marker 
                position={userLocation} 
                icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: '<div class="user-location-marker">📍</div>',
                  iconSize: [30, 30],
                  iconAnchor: [15, 15]
                })}
              >
                <Popup>Your Location</Popup>
              </Marker>
            )}
            
            {/* Safe zone markers */}
            {SAFE_ZONES.map((zone) => (
              <Marker
                key={zone.id}
                position={zone.coordinates}
                icon={getMarkerIcon(zone.type)}
                eventHandlers={{
                  click: () => handleLocationSelect(zone),
                }}
              >
                <Popup>
                  <div className="safe-zone-popup">
                    <h4>{zone.name}</h4>
                    <p className="zone-type">{zone.type.replace('-', ' ').toUpperCase()}</p>
                    <button 
                      className="select-zone-btn"
                      onClick={() => handleLocationSelect(zone)}
                    >
                      Select This Location
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
            
            {/* Selected location marker */}
            {selectedLocation && (
              <Marker
                position={selectedLocation.coordinates}
                icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: '<div class="selected-location-marker">✓</div>',
                  iconSize: [35, 35],
                  iconAnchor: [17, 17]
                })}
              >
                <Popup>
                  <div className="selected-location-popup">
                    <h4>Selected: {selectedLocation.name}</h4>
                    <p>Coordinates: {selectedLocation.coordinates[0].toFixed(4)}, {selectedLocation.coordinates[1].toFixed(4)}</p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        <div className="picker-actions">
          <button 
            className="use-my-location-btn"
            onClick={handleUseMyLocation}
          >
            📍 Use My Location
          </button>
          
          <div className="selected-location-info">
            {selectedLocation ? (
              <div className="location-selected">
                <span className="location-name">📍 {selectedLocation.name}</span>
                <span className="location-type">{selectedLocation.type}</span>
              </div>
            ) : (
              <div className="no-location-selected">
                No location selected
              </div>
            )}
          </div>
          
          <button 
            className="confirm-location-btn"
            onClick={handleConfirm}
            disabled={!selectedLocation}
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}
