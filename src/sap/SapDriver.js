// SapDriver - the contract every backend must implement.
//
// The handlers never talk to SAP directly; they talk to this interface. In
// production the real implementation drives the SAP GUI via SAP GUI Scripting
// (finding screen elements by id, sending transaction codes, scrolling grids).
// In this portfolio the MockSapDriver implements the same contract in memory,
// so the whole pipeline runs and is testable without an SAP system.
//
// This dependency inversion is the key design choice: business logic
// (split, carrier rules, job routing) is decoupled from the brittle UI scripting.

export class SapDriver {
  /** Connect / attach to an SAP session. */
  async connect() {
    throw new Error("not implemented");
  }

  /** Read the line items of a delivery: returns [{ sku, qty }]. (SAP: VL02N) */
  async readDeliveryItems(_delivery) {
    throw new Error("not implemented");
  }

  /** Create a new delivery from a purchase order; returns the delivery number. (SAP: VL10B) */
  async createDeliveryFromOrder(_order) {
    throw new Error("not implemented");
  }

  /** Reduce a delivery to exactly the given items (delete the rest, adjust qty). (SAP: VL02N) */
  async applyItems(_delivery, _items) {
    throw new Error("not implemented");
  }

  /** Set gross weight per SKU and the package count on a delivery. (SAP: VL02N Loading tab) */
  async setWeights(_delivery, _weightBySku, _palletCount) {
    throw new Error("not implemented");
  }

  /** Release a delivery: post goods issue and clear the shipment block. (SAP: VL02N) */
  async releaseDelivery(_delivery) {
    throw new Error("not implemented");
  }

  /** Create a shipment document (DT) for a delivery; returns the DT number. (SAP: VT01N) */
  async createShipmentDoc(_delivery, _carrier) {
    throw new Error("not implemented");
  }

  /** Change the carrier on an existing shipment document. (SAP: VT02N) */
  async changeCarrier(_shipmentDoc, _carrierCode) {
    throw new Error("not implemented");
  }

  /** Unlink a delivery from a shipment document. (SAP: VT02N) */
  async unlinkDelivery(_shipmentDoc, _delivery) {
    throw new Error("not implemented");
  }
}
