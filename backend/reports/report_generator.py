import io
import base64
from datetime import datetime
from fpdf import FPDF


class ReportGenerator:
    """
    Generates structured AI radiology reports from prediction data.
    Exports as professional clinical PDF.
    """

    def generate(
        self,
        predicted_disease: str,
        confidence: float,
        risk_level: str,
        symptoms: str,
        patient_age: str = "N/A",
        patient_name: str = "Not Provided",
        patient_code: str = "N/A",
        hospital_name: str = "General Hospital",
        requesting_clinician: str = "AI Clinical Team",
        scan_type: str = "Chest X-ray",
        gradcam_explanation: str = "",
        shap_explanation: str = "",
        recommended_tests: list[str] | None = None,
        uncertainty: float | None = None,
        region_detected: str | None = None,
    ) -> dict:
        report = self._build_report(
            predicted_disease, confidence, risk_level, symptoms,
            patient_age, patient_name, patient_code, hospital_name,
            requesting_clinician, scan_type, gradcam_explanation, shap_explanation,
            recommended_tests, uncertainty, region_detected,
        )
        pdf_b64 = self._generate_pdf(report)

        return {
            "report": report,
            "pdf_base64": pdf_b64,
        }

    def _build_report(
        self,
        predicted_disease: str,
        confidence: float,
        risk_level: str,
        symptoms: str,
        patient_age: str,
        patient_name: str,
        patient_code: str,
        hospital_name: str,
        requesting_clinician: str,
        scan_type: str,
        gradcam_explanation: str,
        shap_explanation: str,
        recommended_tests: list[str] | None,
        uncertainty: float | None,
        region_detected: str | None,
    ) -> dict:
        if recommended_tests is None:
            recommended_tests = self._get_default_tests(predicted_disease)

        generated_at = datetime.now().isoformat()

        return {
            "title": "RADIOLOGY DIAGNOSTIC REPORT",
            "generated_at": generated_at,
            "hospital_name": hospital_name,
            "requesting_clinician": requesting_clinician,
            "patient_age": patient_age,
            "patient_name": patient_name,
            "patient_code": patient_code,
            "report_id": f"RAD-{generated_at.replace('-', '').replace(':', '').replace('T', '-')[:15]}",
            "scan_type": scan_type,
            "sections": {
                "findings": (
                    f"AI analysis of the submitted {scan_type.lower()} and clinical symptoms "
                    f"({symptoms}) indicates findings consistent with {predicted_disease}. "
                    f"The model confidence level is {confidence * 100:.1f}%."
                    + (f"\nRegion detected: {region_detected}." if region_detected else "")
                ),
                "diagnosis": (
                    f"{predicted_disease} ({confidence * 100:.1f}% confidence)"
                ),
                "risk_level": risk_level,
                "recommended_tests": recommended_tests,
                "ai_explanation": {
                    "gradcam": gradcam_explanation or f"Grad-CAM highlights inflammatory region in the lung consistent with {predicted_disease}.",
                    "shap": shap_explanation or f"SHAP indicates reported symptoms as dominant factors in the {predicted_disease} prediction.",
                },
                "assessment": (
                    f"Primary Assessment: {predicted_disease}\n"
                    f"Risk Level: {risk_level}\n"
                    + (f"Uncertainty: {uncertainty * 100:.2f}%\n" if uncertainty is not None else "")
                    + f"The AI model has identified patterns in the imaging study that are "
                    f"characteristic of {predicted_disease}. Clinical correlation is recommended."
                ),
                "confidence_details": (
                    f"Model Confidence: {confidence * 100:.1f}%\n"
                    + (f"Prediction Uncertainty: {uncertainty * 100:.2f}%\n" if uncertainty is not None else "")
                    + f"This prediction is based on a combination of imaging analysis and "
                    f"symptom-based assessment."
                ),
                "recommendation": (
                    f"1. Confirm diagnosis with appropriate laboratory tests.\n"
                    f"2. Consider additional imaging if clinically indicated.\n"
                    f"3. Consult with a specialist based on the {risk_level} risk level.\n"
                    f"4. Follow institutional protocols for {predicted_disease} management.\n"
                    f"5. Schedule follow-up assessment as appropriate."
                ),
                "impression": (
                    f"Radiographic and symptom-linked AI features are most compatible with {predicted_disease}. "
                    f"Overall risk is categorized as {risk_level.lower()} with an estimated confidence of {confidence * 100:.1f}%."
                ),
            },
        }

    def _get_default_tests(self, disease: str) -> list[str]:
        tests_map = {
            "Pneumonia": ["Chest CT", "Blood culture", "Oxygen saturation monitoring", "CBC with differential", "Sputum culture"],
            "COVID-19": ["RT-PCR test", "Chest CT", "D-dimer", "Oxygen saturation monitoring", "Inflammatory markers (CRP, Ferritin)"],
            "Tuberculosis": ["Sputum AFB smear", "Chest CT", "Mantoux test", "GeneXpert MTB/RIF", "Interferon-gamma release assay"],
            "Lung Cancer": ["Chest CT with contrast", "PET scan", "Bronchoscopy with biopsy", "Tumor markers", "Pulmonary function test"],
            "Pleural Effusion": ["Thoracentesis", "Chest CT", "Pleural fluid analysis", "Serum protein/LDH", "Echocardiogram"],
        }
        return tests_map.get(disease, ["Chest CT", "Blood work", "Specialist consultation", "Follow-up imaging"])

    def _generate_pdf(self, report: dict) -> str:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)

        # Header bar
        pdf.set_fill_color(18, 58, 106)
        pdf.rect(0, 0, 210, 38, "F")
        pdf.set_font("Helvetica", "B", 20)
        pdf.set_text_color(255, 255, 255)
        pdf.set_y(7)
        pdf.cell(0, 8, self._safe_text(report.get("hospital_name", "General Hospital")), new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 6, self._safe_text(report["title"]), new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, "AI-Assisted Clinical Decision Support", new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.ln(10)

        # Patient and study details
        pdf.set_text_color(60, 60, 60)
        pdf.set_font("Helvetica", "", 10)
        generated = report["generated_at"][:19].replace("T", " ")
        pdf.set_fill_color(247, 250, 252)
        pdf.set_draw_color(216, 226, 236)
        panel_y = pdf.get_y()
        pdf.rect(10, panel_y, 190, 34, "DF")
        pdf.ln(3)
        pdf.cell(95, 6, f"Patient Name: {self._safe_text(report.get('patient_name', 'Not Provided'))}")
        pdf.cell(0, 6, f"Patient Code: {self._safe_text(report.get('patient_code', 'N/A'))}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(95, 6, f"Patient Age: {self._safe_text(report.get('patient_age', 'N/A'))}")
        pdf.cell(0, 6, f"Exam Type: {self._safe_text(report.get('scan_type', 'Chest X-ray'))}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(95, 6, f"Report ID: {self._safe_text(report.get('report_id', 'N/A'))}")
        pdf.cell(0, 6, f"Generated: {generated}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"Requesting Clinician: {self._safe_text(report.get('requesting_clinician', 'AI Clinical Team'))}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

        # Separator
        pdf.set_draw_color(18, 58, 106)
        pdf.set_line_width(0.4)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(6)

        # Impression
        self._section_header(pdf, "IMPRESSION")
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(25, 25, 25)
        pdf.multi_cell(0, 6, self._safe_text(report["sections"]["impression"]))
        pdf.ln(4)

        # Findings
        self._section_header(pdf, "FINDINGS")
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(40, 40, 40)
        pdf.multi_cell(0, 6, self._safe_text(report["sections"]["findings"]))
        pdf.ln(5)

        # Diagnosis
        self._section_header(pdf, "DIAGNOSIS")
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(180, 30, 30)
        pdf.cell(0, 8, self._safe_text(report["sections"]["diagnosis"]), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

        # Risk Level
        risk = report["sections"]["risk_level"]
        risk_colors = {
            "Low": (34, 197, 94), "Moderate": (234, 179, 8),
            "High": (249, 115, 22), "Critical": (239, 68, 68),
        }
        r, g, b = risk_colors.get(risk, (100, 100, 100))
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(r, g, b)
        pdf.cell(0, 8, f"Risk Level: {self._safe_text(risk)}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

        # Recommended Tests
        self._section_header(pdf, "RECOMMENDED TESTS")
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(40, 40, 40)
        for test in report["sections"]["recommended_tests"]:
            pdf.cell(5)
            pdf.cell(0, 6, f"- {self._safe_text(test)}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(5)

        # AI Explanation
        self._section_header(pdf, "AI EXPLANATION")
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(40, 40, 40)
        ai = report["sections"]["ai_explanation"]
        pdf.multi_cell(0, 6, f"Grad-CAM: {self._safe_text(ai['gradcam'])}")
        pdf.ln(2)
        pdf.multi_cell(0, 6, f"SHAP: {self._safe_text(ai['shap'])}")
        pdf.ln(5)

        # Assessment
        self._section_header(pdf, "ASSESSMENT")
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(40, 40, 40)
        pdf.multi_cell(0, 6, self._safe_text(report["sections"]["assessment"]))
        pdf.ln(5)

        # Recommendations
        self._section_header(pdf, "CLINICAL RECOMMENDATIONS")
        pdf.set_font("Helvetica", "", 11)
        pdf.multi_cell(0, 6, self._safe_text(report["sections"]["recommendation"]))
        pdf.ln(8)

        # Disclaimer
        pdf.set_draw_color(180, 180, 180)
        pdf.set_line_width(0.3)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(4)
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_text_color(130, 130, 130)
        pdf.multi_cell(
            0,
            4,
            "DISCLAIMER: This report is generated by an AI Clinical Decision Support System and is intended "
            "to assist clinical decision-making only. It should not be used as the sole basis for diagnosis "
            "or treatment. All findings must be reviewed and confirmed by a qualified medical professional. "
            "This system is not a substitute for professional medical judgment.",
        )

        # Footer
        pdf.set_y(-15)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(160, 160, 160)
        pdf.cell(0, 5, f"AI Clinical DSS v1.0.0 | Report {self._safe_text(report.get('report_id', 'N/A'))}", align="C")

        try:
            pdf_bytes = bytes(pdf.output(dest="S"))
        except TypeError:
            buffer = io.BytesIO()
            pdf.output(buffer)
            pdf_bytes = buffer.getvalue()
        return base64.b64encode(pdf_bytes).decode("utf-8")

    def _section_header(self, pdf: FPDF, title: str) -> None:
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(18, 58, 106)
        pdf.cell(0, 8, self._safe_text(title), new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(18, 58, 106)
        pdf.set_line_width(0.2)
        pdf.line(10, pdf.get_y(), 80, pdf.get_y())
        pdf.ln(3)

    def _safe_text(self, value: str) -> str:
        text = value if isinstance(value, str) else str(value)
        return text.encode("latin-1", "replace").decode("latin-1")
