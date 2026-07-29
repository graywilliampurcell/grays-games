export class CollisionManager {
    constructor(mazeData) {
        this.mazeData = mazeData;
        this.blockSize = 1;
    }
    
    isPositionValid(position, radius) {
        const x = Math.floor(position.x);
        const z = Math.floor(position.z);
        const y = Math.floor(position.y);
        
        // Check multiple points around the player to prevent clipping
        const checkPoints = [
            { dx: 0, dz: 0 },
            { dx: radius, dz: 0 },
            { dx: -radius, dz: 0 },
            { dx: 0, dz: radius },
            { dx: 0, dz: -radius },
            { dx: radius, dz: radius },
            { dx: -radius, dz: radius },
            { dx: radius, dz: -radius },
            { dx: -radius, dz: -radius }
        ];
        
        for (const point of checkPoints) {
            const checkX = Math.floor(position.x + point.dx);
            const checkZ = Math.floor(position.z + point.dz);
            const checkY = Math.floor(position.y);
            const checkYUp = Math.floor(position.y + 1.6);
            
            // Check if out of bounds
            if (checkX < 0 || checkX >= this.mazeData.length) return false;
            if (checkZ < 0 || checkZ >= this.mazeData[0].length) return false;
            
            // Check for walls at player height and head height
            if (this.mazeData[checkX] && this.mazeData[checkX][checkZ]) {
                if (this.mazeData[checkX][checkZ][checkY] === 1) return false;
                if (this.mazeData[checkX][checkZ][checkYUp] === 1) return false;
            }
        }
        
        return true;
    }
}