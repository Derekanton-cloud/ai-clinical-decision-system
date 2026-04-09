# ── Clinical guideline database ──
_GUIDELINES: dict[str, dict[str, list[str]]] = {
    "Pneumonia": {
        "Low": [
            "Outpatient oral antibiotics (e.g., amoxicillin)",
            "Rest and hydration",
            "Follow-up chest X-ray in 4–6 weeks",
        ],
        "Moderate": [
            "Chest X-ray (PA and lateral views)",
            "Complete blood count (CBC) with differential",
            "Sputum culture and sensitivity",
            "Consider oral or IV antibiotics based on severity",
        ],
        "High": [
            "Hospital admission for observation",
            "IV antibiotics (e.g., ceftriaxone + azithromycin)",
            "Oxygen saturation monitoring",
            "Arterial blood gas analysis",
            "Pulmonologist consultation",
        ],
        "Critical": [
            "ICU evaluation and admission",
            "Mechanical ventilation readiness",
            "Broad-spectrum IV antibiotics",
            "Sepsis workup (blood cultures, lactate)",
            "Continuous cardiopulmonary monitoring",
        ],
    },
    "Tuberculosis": {
        "Low": [
            "Tuberculin skin test (TST) or IGRA",
            "Sputum AFB smear and culture",
            "Chest X-ray baseline",
        ],
        "Moderate": [
            "Initiate RIPE therapy (Rifampin, Isoniazid, Pyrazinamide, Ethambutol)",
            "Sputum culture and drug sensitivity testing",
            "Patient isolation protocol",
            "Contact tracing notification",
        ],
        "High": [
            "Hospital isolation room admission",
            "Directly Observed Therapy (DOT) initiation",
            "Liver function monitoring (for RIPE side effects)",
            "Infectious disease specialist consultation",
            "CT chest for extent of disease",
        ],
        "Critical": [
            "ICU admission for miliary or disseminated TB",
            "Multi-drug regimen with susceptibility-guided therapy",
            "Respiratory isolation with negative pressure room",
            "Organ function assessment (renal, hepatic)",
        ],
    },
    "COVID-19": {
        "Low": [
            "Home isolation for 5–10 days",
            "Symptomatic treatment (antipyretics, fluids)",
            "PCR testing for confirmation",
            "Monitor oxygen saturation with pulse oximeter",
        ],
        "Moderate": [
            "PCR testing and chest X-ray",
            "Oxygen saturation monitoring every 4 hours",
            "Consider antiviral therapy (e.g., Paxlovid)",
            "D-dimer and CRP blood tests",
        ],
        "High": [
            "Hospital admission with supplemental oxygen",
            "Dexamethasone therapy",
            "Remdesivir infusion consideration",
            "Prone positioning protocol",
            "Thromboprophylaxis (low-molecular-weight heparin)",
        ],
        "Critical": [
            "ICU admission with mechanical ventilation readiness",
            "High-flow nasal cannula or non-invasive ventilation",
            "IL-6 inhibitor consideration (tocilizumab)",
            "ECMO evaluation if refractory hypoxemia",
            "Multi-organ failure monitoring",
        ],
    },
    "Lung Cancer": {
        "Low": [
            "Low-dose CT scan of the chest",
            "Pulmonary function tests",
            "Oncology referral for evaluation",
        ],
        "Moderate": [
            "CT-guided biopsy of suspicious lesion",
            "PET-CT scan for staging",
            "Complete metabolic panel",
            "Oncology and thoracic surgery consultation",
        ],
        "High": [
            "Tissue biopsy with molecular profiling",
            "Brain MRI for metastasis screening",
            "Multidisciplinary tumor board review",
            "Discuss treatment options (surgery, chemo, radiation)",
            "Palliative care consultation",
        ],
        "Critical": [
            "Urgent oncology intervention",
            "Pain management and symptom control",
            "Advanced directive and goals-of-care discussion",
            "Consider clinical trial enrollment",
            "Hospice referral if appropriate",
        ],
    },
    "Pleural Effusion": {
        "Low": [
            "Chest X-ray (PA and lateral decubitus)",
            "Monitor symptoms and repeat imaging in 2 weeks",
            "Basic metabolic panel",
        ],
        "Moderate": [
            "Diagnostic thoracentesis",
            "Pleural fluid analysis (Light's criteria)",
            "Chest ultrasound for fluid localization",
            "CBC and protein/LDH levels",
        ],
        "High": [
            "Therapeutic thoracentesis for symptom relief",
            "CT chest with contrast",
            "Pleural biopsy if exudative effusion",
            "Pulmonologist consultation",
            "Evaluate for underlying malignancy or infection",
        ],
        "Critical": [
            "Chest tube insertion for large or tension effusion",
            "ICU monitoring for respiratory compromise",
            "Pleurodesis consideration for recurrent effusion",
            "Surgical consultation (VATS if indicated)",
        ],
    },
    "Normal": {
        "Low": [
            "No immediate intervention required",
            "Routine health screening recommended",
            "Annual follow-up chest X-ray if symptomatic",
        ],
        "Moderate": [
            "Clinical correlation with symptoms",
            "Consider repeat imaging in 3–6 months",
            "Primary care follow-up",
        ],
        "High": [
            "Further diagnostic workup recommended",
            "Specialist referral for persistent symptoms",
        ],
        "Critical": [
            "Re-evaluate diagnosis — clinical picture does not match",
            "Urgent specialist consultation",
        ],
    },
}

_DEFAULT_RECS = [
    "Clinical correlation recommended",
    "Follow-up with primary care physician",
    "Repeat imaging if symptoms persist",
]


class GuidelineEngine:
    """Return evidence-based clinical recommendations based on disease and risk level."""

    def generate_guideline(self, disease: str, risk_level: str) -> dict:
        """
        Look up clinical recommendations for a given disease and risk level.

        Returns:
            {"recommendations": [str, ...]}
        """
        disease_guidelines = _GUIDELINES.get(disease) or _GUIDELINES.get(disease.title())

        if disease_guidelines is None:
            return {"recommendations": _DEFAULT_RECS}

        recs = disease_guidelines.get(risk_level)
        if recs is None:
            recs = disease_guidelines.get("Moderate", _DEFAULT_RECS)

        return {"recommendations": recs}
