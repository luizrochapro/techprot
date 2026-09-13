/**
 * Complex.js - Complex number math for electrical engineering calculations
 * Supports Cartesian (re + j*im) and Polar (r * exp(j*theta)) representations.
 */
export class Complex {
    constructor(re = 0.0, im = 0.0) {
        this.re = Number(re) || 0.0;
        this.im = Number(im) || 0.0;
    }

    static fromPolar(r, thetaRad) {
        return new Complex(r * Math.cos(thetaRad), r * Math.sin(thetaRad));
    }

    static fromPolarDeg(r, thetaDeg) {
        const rad = (thetaDeg * Math.PI) / 180.0;
        return new Complex(r * Math.cos(rad), r * Math.sin(rad));
    }

    add(c) {
        if (typeof c === 'number') return new Complex(this.re + c, this.im);
        return new Complex(this.re + c.re, this.im + c.im);
    }

    sub(c) {
        if (typeof c === 'number') return new Complex(this.re - c, this.im);
        return new Complex(this.re - c.re, this.im - c.im);
    }

    mul(c) {
        if (typeof c === 'number') return new Complex(this.re * c, this.im * c);
        return new Complex(
            this.re * c.re - this.im * c.im,
            this.re * c.im + this.im * c.re
        );
    }

    div(c) {
        if (typeof c === 'number') {
            if (c === 0) return new Complex(Infinity, Infinity);
            return new Complex(this.re / c, this.im / c);
        }
        const denom = c.re * c.re + c.im * c.im;
        if (denom === 0) return new Complex(Infinity, Infinity);
        return new Complex(
            (this.re * c.re + this.im * c.im) / denom,
            (this.im * c.re - this.re * c.im) / denom
        );
    }

    conj() {
        return new Complex(this.re, -this.im);
    }

    abs() {
        return Math.hypot(this.re, this.im);
    }

    absSq() {
        return this.re * this.re + this.im * this.im;
    }

    arg() {
        return Math.atan2(this.im, this.re);
    }

    angle() {
        return Math.atan2(this.im, this.re);
    }

    argDeg() {
        return (Math.atan2(this.im, this.re) * 180.0) / Math.PI;
    }

    angleDeg() {
        return (Math.atan2(this.im, this.re) * 180.0) / Math.PI;
    }

    inv() {
        const denom = this.re * this.re + this.im * this.im;
        if (denom === 0) return new Complex(Infinity, Infinity);
        return new Complex(this.re / denom, -this.im / denom);
    }

    neg() {
        return new Complex(-this.re, -this.im);
    }

    clone() {
        return new Complex(this.re, this.im);
    }

    isZero(eps = 1e-12) {
        return Math.abs(this.re) < eps && Math.abs(this.im) < eps;
    }

    toString(precision = 4) {
        const sign = this.im >= 0 ? '+' : '-';
        return `${this.re.toFixed(precision)} ${sign} j${Math.abs(this.im).toFixed(precision)}`;
    }

    toPolarString(precision = 4) {
        return `${this.abs().toFixed(precision)} ∠ ${this.argDeg().toFixed(2)}°`;
    }
}
