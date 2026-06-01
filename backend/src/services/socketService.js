const { Server } = require('socket.io');
const logger = require('../utils/logger');

// ─────────────────────────────────────────
// MODULE STATE
// ─────────────────────────────────────────
let io = null;

// Stores user location keyed by socket.id
// { [socketId]: { lat, lng, companyId } }
const userLocations = new Map();

// ─────────────────────────────────────────
// ROOM NAMING
// ─────────────────────────────────────────
const Rooms = {
    company: (companyId) => `company:${companyId}`,
};

// ─────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────
const Events = {
    // Server → Client
    GPS_UPDATE:   'gps:update',   // new bus position + ETA
    ERROR:        'error',

    // Client → Server
    JOIN_COMPANY: 'join:company', // { companyId, userLat, userLng }
    LEAVE_COMPANY:'leave:company',// { companyId }
    UPDATE_LOCATION: 'update:location', // { userLat, userLng } — user moved
};

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
function init(httpServer) {
    if (io) {
        logger.warn('⚠️ socketService.init() called more than once — skipping');
        return io;
    }

    io = new Server(httpServer, {
        cors: {
            origin:      process.env.CLIENT_URL || 'http://localhost:3000',
            methods:     ['GET', 'POST'],
            credentials: true,
        },
        pingInterval: 25000,
        pingTimeout:  60000,
        transports:   ['websocket', 'polling'],
    });

    io.on('connection', (socket) => {
        const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
        logger.info(`🔌 Client connected: ${socket.id} (${clientIp})`);

        // ── JOIN COMPANY ROOM ─────────────────
        // Payload: { companyId, userLat, userLng }
        socket.on(Events.JOIN_COMPANY, ({ companyId, userLat, userLng } = {}) => {
            if (!companyId) {
                socket.emit(Events.ERROR, { message: 'companyId is required' });
                return;
            }

            // Join the room — do NOT leave other rooms.
            // This app joins ALL company rooms simultaneously
            // so the user sees every bus from every company.
            const room = Rooms.company(companyId);
            socket.join(room);

            // Store user location — update for every company join
            // so all rooms have the latest position for ETA
            if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
                userLocations.set(socket.id, {
                    lat:       userLat,
                    lng:       userLng,
                    companyId: Number(companyId),
                });
                logger.debug(
                    `📍 User location stored: socket=${socket.id} | ` +
                    `lat=${userLat}, lng=${userLng} | company=${companyId}`
                );
            }

            logger.info(`📡 Socket ${socket.id} joined room ${room}`);
        });

        // ── UPDATE USER LOCATION ──────────────
        // Called when the user moves significantly
        // Payload: { userLat, userLng }
        socket.on(Events.UPDATE_LOCATION, ({ userLat, userLng } = {}) => {
            if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return;

            const existing = userLocations.get(socket.id);
            if (!existing) return;

            userLocations.set(socket.id, {
                ...existing,
                lat: userLat,
                lng: userLng,
            });

            logger.debug(
                `📍 User location updated: socket=${socket.id} | lat=${userLat}, lng=${userLng}`
            );
        });

        // ── LEAVE COMPANY ROOM ────────────────
        socket.on(Events.LEAVE_COMPANY, ({ companyId } = {}) => {
            if (!companyId) return;
            socket.leave(Rooms.company(companyId));
            userLocations.delete(socket.id);
            logger.info(`📴 Socket ${socket.id} left room company:${companyId}`);
        });

        // ── DISCONNECT ────────────────────────
        socket.on('disconnect', (reason) => {
            userLocations.delete(socket.id);
            logger.info(`🔌 Client disconnected: ${socket.id} — reason: ${reason}`);
        });

        // ── ERROR ─────────────────────────────
        socket.on('error', (error) => {
            logger.error(`🔥 Socket error (${socket.id}):`, error.message);
        });
    });

    logger.info('✅ Socket.IO server initialised');
    return io;
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function leaveAllCompanyRooms(socket) {
    for (const room of socket.rooms) {
        if (room.startsWith('company:')) {
            socket.leave(room);
            userLocations.delete(socket.id);
            logger.debug(`📴 Socket ${socket.id} auto-left room ${room}`);
        }
    }
}

// ─────────────────────────────────────────
// GET USER LOCATIONS FOR A COMPANY
// Returns all stored user locations for clients
// currently watching a specific company.
// Called by gpsService on every GPS tick.
//
// Returns: Array<{ socketId, lat, lng }>
// ─────────────────────────────────────────
function getUserLocationsForCompany(companyId) {
    const result = [];
    const room   = Rooms.company(companyId);

    if (!io) return result;

    const roomSockets = io.sockets.adapter.rooms.get(room);
    if (!roomSockets) return result;

    for (const socketId of roomSockets) {
        const loc = userLocations.get(socketId);
        if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
            result.push({ socketId, lat: loc.lat, lng: loc.lng });
        }
    }

    return result;
}

// ─────────────────────────────────────────
// GPS UPDATE EMITTER
// Emits to a specific socket (one user) or
// the whole company room.
//
// Payload shape:
// {
//   vehicleId:        number,
//   companyId:        number,
//   latitude:         number,
//   longitude:        number,
//   speed:            number,
//   direction:        number,
//   status:           string,
//   timestamp:        string,
//   gps_quality:      string,
//   eta:              string | null,   e.g. "8 min"
//   duration_seconds: number | null,
//   distance_meters:  number | null,
//   distance_text:    string | null,
// }
// ─────────────────────────────────────────
function emitGPSUpdate(companyId, vehicleId, locationData, etaData = null) {
    if (!io) {
        logger.warn('⚠️ emitGPSUpdate called before socketService.init()');
        return;
    }

    const room = Rooms.company(companyId);

    const payload = {
        vehicleId,
        companyId,
        ...locationData,
        eta:              etaData?.eta              ?? null,
        duration_seconds: etaData?.duration_seconds ?? null,
        distance_meters:  etaData?.distance_meters  ?? null,
        distance_text:    etaData?.distance_text    ?? null,
    };

    io.to(room).emit(Events.GPS_UPDATE, payload);

    logger.debug(
        `📡 GPS update → room ${room} | vehicle ${vehicleId} | ` +
        `lat=${locationData.latitude}, lng=${locationData.longitude} | ` +
        `eta=${etaData?.eta ?? 'N/A'}`
    );
}

// ─────────────────────────────────────────
// EMIT TO SPECIFIC SOCKET
// Used when ETA is calculated per-user
// (each user may be at a different location)
// ─────────────────────────────────────────
function emitToSocket(socketId, event, data) {
    if (!io) return;
    io.to(socketId).emit(event, data);
}

// ─────────────────────────────────────────
// STATS
// ─────────────────────────────────────────
function getStats() {
    if (!io) return { connectedClients: 0, rooms: [], usersWithLocation: 0 };

    const rooms = [];
    for (const [roomName, sockets] of io.sockets.adapter.rooms) {
        if (!roomName.startsWith('company:')) continue;
        rooms.push({ room: roomName, clients: sockets.size });
    }

    return {
        connectedClients:  io.sockets.sockets.size,
        usersWithLocation: userLocations.size,
        rooms,
    };
}

function getIO() {
    if (!io) throw new Error('socketService not initialised — call init(httpServer) first');
    return io;
}

module.exports = {
    init,
    emitGPSUpdate,
    emitToSocket,
    getUserLocationsForCompany,
    getStats,
    getIO,
    Events,
    Rooms,
};