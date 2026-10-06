import os
import shutil
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

SRC_TEMPLATE = r"C:\Users\HP VICTUS\Downloads\ML Review 2-Deepfake Detector.pptx"
OUT_DOWNLOADS = r"C:\Users\HP VICTUS\Downloads\ML_Review_2_Missed_Lead_Detector.pptx"
OUT_WORKSPACE = r"c:\Users\HP VICTUS\Desktop\ML\missed_lead_detector\ML_Review_2_Missed_Lead_Detector.pptx"

IMG_LEAD_TRIAGE = r"C:\Users\HP VICTUS\.gemini\antigravity-ide\brain\afe6c0f8-013f-4686-a5f9-09d6009028de\lead_triage_flow_1791305111549.jpg"
IMG_NLP_PIPELINE = r"C:\Users\HP VICTUS\.gemini\antigravity-ide\brain\afe6c0f8-013f-4686-a5f9-09d6009028de\nlp_ml_pipeline_1791305191667.jpg"
IMG_SLA_RECOVERY = r"C:\Users\HP VICTUS\.gemini\antigravity-ide\brain\afe6c0f8-013f-4686-a5f9-09d6009028de\sla_recovery_engine_1791305307516.jpg"
IMG_DASHBOARD = r"C:\Users\HP VICTUS\.gemini\antigravity-ide\brain\afe6c0f8-013f-4686-a5f9-09d6009028de\dashboard_analytics_1791305441298.jpg"

print("Images exist:")
print("  Triage:", os.path.exists(IMG_LEAD_TRIAGE))
print("  NLP:", os.path.exists(IMG_NLP_PIPELINE))
print("  SLA:", os.path.exists(IMG_SLA_RECOVERY))
print("  Dashboard:", os.path.exists(IMG_DASHBOARD))
