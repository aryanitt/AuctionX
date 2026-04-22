"""
Socket.io event handlers.

Handles WebSocket lifecycle events (connect, disconnect) and room
management for real-time auction updates.
"""

import logging

logger = logging.getLogger(__name__)


def register_socket_events(sio):
    """Attach all Socket.io event handlers to the given server instance."""

    @sio.event
    async def connect(sid, environ, auth):
        logger.info("[socket] Client connected: %s", sid)

    @sio.event
    async def disconnect(sid):
        logger.info("[socket] Client disconnected: %s", sid)

    @sio.event
    async def join_rfq(sid, rfq_id):
        """Client joins a room to receive live bid updates for a specific RFQ."""
        room = f"rfq:{rfq_id}"
        await sio.enter_room(sid, room)
        logger.info("[socket] %s joined room %s", sid, room)

    @sio.event
    async def leave_rfq(sid, rfq_id):
        """Client leaves an RFQ room."""
        room = f"rfq:{rfq_id}"
        await sio.leave_room(sid, room)
        logger.info("[socket] %s left room %s", sid, room)
