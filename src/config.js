// Configuration and business constants.
//
// All carrier names, codes, SAP identifiers and document patterns here are
// fictional. They mirror the structure of a real SAP export operation without
// exposing any real company, system, carrier, or document data.

// Physical / business constants used when splitting a delivery into a convoy.
export const PALLET_WEIGHT_KG = 30; // empty-pallet weight added per pallet
export const PALLETS_PER_TRUCK = 28; // position capacity of one trailer
export const WEIGHT_LIMIT_KG = 25000; // default payload limit
export const WEIGHT_LIMIT_BY_COUNTRY = { PY: 27000 }; // one lane runs heavier

// SAP environment (genericised). The real values identify the company's SAP
// landscape, so they are placeholders here.
export const SAP_CONFIG = {
  connectionName: "PRD - ECC Production",
  transportPlanningPoint: "TP01",
  supplyingPlant: "0001",
  loadType: "DRY",
  shippingProcess: "EXPORT_STD",
  deliverySystem: "ZTDV",
  loadingMode: "PALLETIZED",
};

// Carrier directory: name -> { code, equipType, shipmentType }.
// Fictional carriers and SAP codes. shipmentType ZA08 vs ZA09 drives downstream
// SAP configuration; equipType is the SAP equipment category.
export const CARRIERS = {
  "andes cargo": { code: "10000011", equipType: "EQ-A", shipmentType: "ZA08" },
  "rio logistica": { code: "10000022", equipType: "EQ-A", shipmentType: "ZA08" },
  "pampa freight": { code: "10000033", equipType: "EQ-B", shipmentType: "ZA09" },
  "delta transportes": { code: "10000044", equipType: "EQ-A", shipmentType: "ZA08" },
  "norte express": { code: "10000055", equipType: "EQ-B", shipmentType: "ZA09" },
  "sur logistics": { code: "10000066", equipType: "EQ-B", shipmentType: "ZA09" },
  "central cargo": { code: "10000077", equipType: "EQ-B", shipmentType: "ZA09" },
  "litoral transp": { code: "10000088", equipType: "EQ-A", shipmentType: "ZA08" },
  "vale freight": { code: "10000099", equipType: "EQ-B", shipmentType: "ZA09" },
  "horizonte log": { code: "10000110", equipType: "EQ-B", shipmentType: "ZA09" },
};

// Document-number shapes, used to auto-correct fields that arrive swapped from
// the Teams message (operators sometimes paste columns out of order).
export const PATTERNS = {
  order: /^45\d{8}$/, // purchase order: 10 digits starting 45
  delivery: /^80\d{7}$/, // delivery: 9 digits starting 80
  shipmentDoc: /^17\d{6,8}$/, // DT / shipment document: starts 17
  carrierCode: /^(10|50)\d{6}$/, // carrier SAP code
};

// Fixed column order of the command table pasted in Teams.
export const TEAMS_TABLE_COLUMNS = ["order", "delivery", "carrier", "shipmentDoc"];
