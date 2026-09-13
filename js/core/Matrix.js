import { Complex } from './Complex.js';

/**
 * Matrix.js - Real and Complex matrix linear algebra operations
 * Includes LU factorization with partial pivoting for linear system solving.
 */
export class Matrix {
    /**
     * Solves real linear system A * x = b using Gaussian elimination with partial pivoting.
     * @param {number[][]} A - Square coefficient matrix (n x n)
     * @param {number[]} b - Right hand side vector (n)
     * @returns {number[]} Solution vector x
     */
    static solveLinearSystem(A, b) {
        const n = b.length;
        // Make deep copies
        const M = A.map(row => [...row]);
        const x = [...b];

        for (let i = 0; i < n; i++) {
            // Find pivot
            let maxRow = i;
            let maxVal = Math.abs(M[i][i]);
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(M[k][i]) > maxVal) {
                    maxVal = Math.abs(M[k][i]);
                    maxRow = k;
                }
            }

            if (maxVal < 1e-14) {
                console.warn(`Matrix singular or near-singular at row ${i}`);
            }

            // Swap rows
            if (maxRow !== i) {
                const tempRow = M[i];
                M[i] = M[maxRow];
                M[maxRow] = tempRow;

                const tempB = x[i];
                x[i] = x[maxRow];
                x[maxRow] = tempB;
            }

            // Eliminate column below
            for (let k = i + 1; k < n; k++) {
                const factor = M[k][i] / M[i][i];
                x[k] -= factor * x[i];
                for (let j = i; j < n; j++) {
                    M[k][j] -= factor * M[i][j];
                }
            }
        }

        // Back substitution
        for (let i = n - 1; i >= 0; i--) {
            let sum = x[i];
            for (let j = i + 1; j < n; j++) {
                sum -= M[i][j] * x[j];
            }
            x[i] = sum / M[i][i];
        }

        return x;
    }

    /**
     * Solves complex linear system Z * I = V using Gaussian elimination with partial pivoting.
     * @param {Complex[][]} A - Complex square matrix
     * @param {Complex[]} b - Complex vector
     * @returns {Complex[]} Solution vector
     */
    static solveComplexSystem(A, b) {
        const n = b.length;
        const M = A.map(row => row.map(c => c.clone()));
        const x = b.map(c => c.clone());

        for (let i = 0; i < n; i++) {
            let maxRow = i;
            let maxVal = M[i][i].abs();
            for (let k = i + 1; k < n; k++) {
                if (M[k][i].abs() > maxVal) {
                    maxVal = M[k][i].abs();
                    maxRow = k;
                }
            }

            if (maxRow !== i) {
                const tempRow = M[i];
                M[i] = M[maxRow];
                M[maxRow] = tempRow;

                const tempB = x[i];
                x[i] = x[maxRow];
                x[maxRow] = tempB;
            }

            for (let k = i + 1; k < n; k++) {
                const factor = M[k][i].div(M[i][i]);
                x[k] = x[k].sub(factor.mul(x[i]));
                for (let j = i; j < n; j++) {
                    M[k][j] = M[k][j].sub(factor.mul(M[i][j]));
                }
            }
        }

        for (let i = n - 1; i >= 0; i--) {
            let sum = x[i];
            for (let j = i + 1; j < n; j++) {
                sum = sum.sub(M[i][j].mul(x[j]));
            }
            x[i] = sum.div(M[i][i]);
        }

        return x;
    }

    /**
     * Inverts a complex matrix (used for Zbus = Ybus^-1)
     */
    static invertComplexMatrix(A) {
        const n = A.length;
        const inv = [];
        for (let col = 0; col < n; col++) {
            const b = [];
            for (let row = 0; row < n; row++) {
                b.push(row === col ? new Complex(1.0, 0.0) : new Complex(0.0, 0.0));
            }
            const sol = Matrix.solveComplexSystem(A, b);
            for (let row = 0; row < n; row++) {
                if (!inv[row]) inv[row] = [];
                inv[row][col] = sol[row];
            }
        }
        return inv;
    }
}
