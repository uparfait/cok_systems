// this model is for parking slots, it will be used to store the parking slots information in the database

const mongoose = require('mongoose');

const parkingSlotSchema = new mongoose.Schema({
    totalSlots: {
        type: Number,
        required: true
    },

    visitorsReservedSlots: {
        type: Number,
        required: true
    },
    staffReservedSlots: {
        type: Number,
        required: true
    },
    visitorsAvailableSlots: {
        type: Number,
        required: true
    },
    staffAvailableSlots: {
        type: Number,
        required: true
    },

    RegularReservedSlots: {
        type: Number,
        required: true
    },

    RegularAvailableSlots: {
        type: Number,
        required: true
    },

    UnChangedId: {
        type: String,
        default: 'parking_slots',
        unique: true
    }

});

const ParkingSlot = mongoose.model('ParkingSlot', parkingSlotSchema);

module.exports = ParkingSlot;