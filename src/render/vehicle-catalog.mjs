import {EXPANSION_VEHICLES} from './expansion-vehicle-definitions.mjs?v=body-r3-20260916';
// Source identities and dimensions are measured from the supplied GLB, not factory specifications.
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export const VEHICLE_CATALOG=freeze({
  ...EXPANSION_VEHICLES,
  "chevy": {
    "id": "chevy",
    "label": "Chevy V3",
    "selectable": false,
    "supportsDetailedEngine": true
  },
  "falcon": {
    "id": "falcon",
    "label": "Falcon coupé",
    "selectable": false,
    "supportsDetailedEngine": false
  },
  "chevrolet_1969": {
    "id": "chevrolet_1969",
    "file": "Chevy_1969.glb",
    "sourceSha256": "1a62d5b9099654150c5d4e6c3827c655554eb99c408a8e0780a77901b714845a",
    "sourceIdentity": "Chevy_Serie_2_Naranja_Negra_V4_Auditada",
    "artisticRecreation": true,
    "sourceBoundsM": {
      "min": [
        -2.4412500858306885,
        0,
        -1.0175138711929321
      ],
      "max": [
        2.4549999237060547,
        1.4194165422916412,
        1.017522931098938
      ],
      "size": [
        4.896250009536743,
        1.4194165422916412,
        2.03503680229187
      ]
    },
    "sourceWheelbaseM": 2.819,
    "sourceScale": 0.4,
    "sourceShiftY": -0.296283007,
    "centers": [
      [
        -0.5658000000000001,
        -0.1643695238571472,
        -0.30200000000000005
      ],
      [
        -0.5658000000000001,
        -0.1643695238571472,
        0.30200000000000005
      ],
      [
        0.5618000000000001,
        -0.1643695238571472,
        -0.30200000000000005
      ],
      [
        0.5618000000000001,
        -0.1643695238571472,
        0.30200000000000005
      ]
    ],
    "lampAnchor": [
      -0.9581282531738282,
      0.021030483486145057,
      0.2820917010307312
    ],
    "hoodHinge": [
      -0.3065396070480347,
      0.09737791800686646,
      0
    ],
    "calibration": {
      "wheelbaseM": 2.819,
      "cgHeightM": 0.56,
      "radiusM": 0.315,
      "tireWidthM": 0.185,
      "heightM": 1.4194165422916412,
      "frontWeight": 0.54,
      "frontTrackM": 1.48,
      "rearTrackM": 1.47,
      "sourceRoof": 0.27148360991665654,
      "sourceFrontX": -0.5658000000000001,
      "sourceRearX": 0.5618000000000001,
      "sourceWheelY": -0.1643695238571472,
      "sourceHalfTrack": 0.30200000000000005
    },
    "sourceBytes": 64852916,
    "sourceModifiedUtc": "2026-09-06T23:26:37.146128+00:00",
    "label": "Chevy 250 SS Serie 2",
    "selectable": true,
    "preserveAuthoredMaterials": true,
    "supportsDetailedEngine": true,
    "supportsHood": true,
    "cockpit": "shared-adjustable",
    "physics": "shared-chevy-chassis",
    "sourceFrontAxis": "-X",
    "engineMount": {
      "coordinateSpace": "presentation-root",
      "unitsPerMeter": 0.4,
      "metersPerUnit": 2.5,
      "sourceShiftY": -0.296283007,
      "center": [
        -0.5599999999999999,
        -0.12619292180797526,
        0.0
      ],
      "sourceCenterM": [
        -1.4,
        0.4252252129800618,
        0
      ],
      "rotationY": -1.5707963267948966,
      "bayBounds": {
        "min": [
          -0.802,
          -0.26428300699999996,
          -0.2336
        ],
        "max": [
          -0.32000000000000006,
          0.06780708670803837,
          0.2336
        ]
      },
      "sourceBayBoundsM": {
        "min": [
          -2.005,
          0.08,
          -0.584
        ],
        "max": [
          -0.8,
          0.9102252342700958,
          0.584
        ]
      },
      "hoodBounds": {
        "min": [
          -0.9027999877929688,
          0.08180708670803838,
          -0.2861776113510132
        ],
        "max": [
          -0.3065396070480347,
          0.1077584722060852,
          0.2861776113510132
        ]
      },
      "hoodSourceNode": "Capot_Independiente__01",
      "hoodClearanceM": 0.035,
      "engineBoundsM": {
        "min": [
          -0.49993783235549927,
          -0.23100000619888306,
          -0.4526349604129791
        ],
        "max": [
          0.35099999979138374,
          0.572000018786639,
          0.598223865032196
        ],
        "size": [
          0.850937832146883,
          0.803000024985522,
          1.0508588254451752
        ],
        "center": [
          -0.07446891628205776,
          0.17050000629387796,
          0.07279445230960846
        ]
      },
      "engineBlockCenterM": [
        5.06955810664067e-09,
        0.08699999749660492,
        0
      ],
      "engineSourceSha256": "52e965af9dccd75bfbc9bbf8af0c536522346287a0e99d31e01c83468a3939bb"
    }
  },
  "chevy_400_1957": {
    "id": "chevy_400_1957",
    "file": "Chevy_400_1957.glb",
    "sourceBytes": 68634276,
    "sourceModifiedUtc": "2026-09-06T23:50:39.594887+00:00",
    "sourceSha256": "16c7876fd4a0cd382227464fe25409082f0b4eb62199b785bba69857890deb70",
    "sourceIdentity": "Chevy_Serie_2_Mejorada",
    "artisticRecreation": true,
    "sourceBoundsM": {
      "min": [
        -2.514782190322876,
        2.622604189372879e-09,
        -1.0613517761230467
      ],
      "max": [
        2.3521595001220703,
        1.5732945203781128,
        1.061351776123047
      ],
      "size": [
        4.866941690444946,
        1.5732945177555087,
        2.1227035522460938
      ]
    },
    "sourceWheelbaseM": 2.8446399843874923,
    "sourceScale": 0.4,
    "sourceShiftY": -0.296283007,
    "centers": [
      [
        -0.5740175990636309,
        -0.15268300699999993,
        -0.32959999999999995
      ],
      [
        -0.5740175990636309,
        -0.15268300700000006,
        0.32960000000000006
      ],
      [
        0.5638383946913661,
        -0.15268300699999993,
        -0.32959999999999995
      ],
      [
        0.5638383946913661,
        -0.15268300700000006,
        0.32960000000000006
      ]
    ],
    "lampAnchor": [
      -0.9761433517456055,
      0.021332549716919003,
      0.2893581867218017
    ],
    "hoodHinge": [
      -0.2460040092468262,
      0.12663603749462893,
      0
    ],
    "calibration": {
      "wheelbaseM": 2.819,
      "cgHeightM": 0.56,
      "radiusM": 0.315,
      "tireWidthM": 0.185,
      "heightM": 1.5732945177555087,
      "frontWeight": 0.54,
      "frontTrackM": 1.48,
      "rearTrackM": 1.47,
      "sourceRoof": 0.3330348011512452,
      "sourceFrontX": -0.5740175990636309,
      "sourceRearX": 0.5638383946913661,
      "sourceWheelY": -0.15268300699999993,
      "sourceHalfTrack": 0.32959999999999995
    },
    "label": "Chevrolet 400",
    "selectable": true,
    "preserveAuthoredMaterials": true,
    "supportsDetailedEngine": true,
    "supportsHood": true,
    "cockpit": "shared-adjustable",
    "physics": "shared-chevy-chassis",
    "sourceFrontAxis": "-X",
    "engineMount": {
      "coordinateSpace": "presentation-root",
      "unitsPerMeter": 0.4,
      "metersPerUnit": 2.5,
      "sourceShiftY": -0.296283007,
      "center": [
        -0.5599999999999999,
        -0.10662607410213426,
        0.0
      ],
      "sourceCenterM": [
        -1.4,
        0.4741423322446643,
        0
      ],
      "rotationY": -1.5707963267948966,
      "bayBounds": {
        "min": [
          -0.8980000000000001,
          -0.26428300699999996,
          -0.24
        ],
        "max": [
          -0.27,
          0.08737393441387936,
          0.24
        ]
      },
      "sourceBayBoundsM": {
        "min": [
          -2.245,
          0.08,
          -0.6
        ],
        "max": [
          -0.675,
          0.9591423535346983,
          0.6
        ]
      },
      "hoodBounds": {
        "min": [
          -0.959779167175293,
          0.10137393441387937,
          -0.28299822807312003
        ],
        "max": [
          -0.2460040092468262,
          0.14347743954846193,
          0.28299829959869394
        ]
      },
      "hoodSourceNode": "V7_Hood_continuous_skin",
      "hoodClearanceM": 0.035,
      "engineBoundsM": {
        "min": [
          -0.49993783235549927,
          -0.23100000619888306,
          -0.4526349604129791
        ],
        "max": [
          0.35099999979138374,
          0.572000018786639,
          0.598223865032196
        ],
        "size": [
          0.850937832146883,
          0.803000024985522,
          1.0508588254451752
        ],
        "center": [
          -0.07446891628205776,
          0.17050000629387796,
          0.07279445230960846
        ]
      },
      "engineBlockCenterM": [
        5.06955810664067e-09,
        0.08699999749660492,
        0
      ],
      "engineSourceSha256": "52e965af9dccd75bfbc9bbf8af0c536522346287a0e99d31e01c83468a3939bb"
    }
  }
});
export function getVehicleDefinition(id){return VEHICLE_CATALOG[id]||null;}
