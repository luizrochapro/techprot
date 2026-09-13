/**
 * Element.js - Base class for all power system visual & electrical elements.
 */
let nextElementId = 1;

export class Element {
    constructor(type, x = 0, y = 0) {
        this.id = nextElementId++;
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.angle = 0; // In degrees (0, 90, 180, 270)
        this.selected = false;
        this.hovered = false;
        this.isOnline = true;
        this.name = `${type}_${this.id}`;
        
        // Connectivity
        this.parentBuses = []; // Array of Bus objects connected
        this.pointList = [];   // Intermediate line/terminal points if applicable
        
        // Simulation Results container
        this.results = {};
    }

    static resetIdCounter(val = 1) {
        nextElementId = val;
    }

    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }

    containsPoint(px, py) {
        const b = this.getBounds();
        return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
    }

    intersectsBox(x1, y1, x2, y2) {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        const b = this.getBounds();
        return !(b.x + b.width < minX || b.x > maxX || b.y + b.height < minY || b.y > maxY);
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;
        if (this.pointList && this.pointList.length > 0) {
            for (const pt of this.pointList) {
                pt.x += dx;
                pt.y += dy;
            }
        }
    }

    rotate() {
        this.angle = (this.angle + 90) % 360;
    }

    snapToGrid(gridSize = 20) {
        this.x = Math.round(this.x / gridSize) * gridSize;
        this.y = Math.round(this.y / gridSize) * gridSize;
        if (this.pointList) {
            for (const pt of this.pointList) {
                pt.x = Math.round(pt.x / gridSize) * gridSize;
                pt.y = Math.round(pt.y / gridSize) * gridSize;
            }
        }
    }
}
