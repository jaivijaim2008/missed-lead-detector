# -*- coding: utf-8 -*-
"""
Full report generator script for Missed Lead Detector & Recovery Suite.
Preserves:
- All styles, font families (Times New Roman), font sizes, font colors
- All bullet points and list indentation
- All borders, cell shading, and table formatting
- All institutional drawings, logos, and layouts
"""

import os
import shutil
import docx

import content_front
import content_ch1_ch3
import content_ch4_ch5
import content_ch6_ch8

TEMPLATE_PATH = "template_report.docx"
OUTPUT_LOCAL = "Machine_Learning_Missed_Lead_Report.docx"
OUTPUT_DOWNLOADS = r"C:\Users\HP VICTUS\Downloads\Machine_Learning_Missed_Lead_Report.docx"
ALT_DOWNLOADS = r"C:\Users\HP VICTUS\Downloads\Mislead_Detection_ML_Report.docx"

def update_paragraph(p, new_text):
    if new_text is None:
        return
    # Preserve drawings/logos
    if '<w:drawing' in p._p.xml:
        return

    runs = p.runs
    if not runs:
        if new_text.strip():
            p.add_run(new_text)
        return

    # Keep formatting from the first run
    r0 = runs[0]
    r0.text = new_text
    for r in runs[1:]:
        r.text = ""

def update_cell(cell, new_text):
    if new_text is None:
        return
    if not cell.paragraphs:
        cell.text = new_text
        return
    p = cell.paragraphs[0]
    if p.runs:
        r0 = p.runs[0]
        r0.text = new_text
        for r in p.runs[1:]:
            r.text = ""
    else:
        p.text = new_text
    for extra_p in cell.paragraphs[1:]:
        extra_p.text = ""

def main():
    print(f"Loading template: {TEMPLATE_PATH}...")
    doc = docx.Document(TEMPLATE_PATH)
    print(f"Total Paragraphs: {len(doc.paragraphs)}, Total Tables: {len(doc.tables)}")

    # Combine all paragraphs
    all_paras = {}
    all_paras.update(content_front.PARAGRAPHS)
    all_paras.update(content_ch1_ch3.PARAGRAPHS)
    all_paras.update(content_ch4_ch5.PARAGRAPHS)
    all_paras.update(content_ch6_ch8.PARAGRAPHS)

    # Combine all tables
    all_tables = {
        0: content_front.TABLE_0,
        1: content_front.TABLE_1,
        2: content_front.TABLE_2,
        3: content_front.TABLE_3,
        4: content_front.TABLE_4,
        5: content_ch1_ch3.TABLE_5,
        6: content_ch1_ch3.TABLE_6,
        7: content_ch1_ch3.TABLE_7,
        8: content_ch1_ch3.TABLE_8,
        9: content_ch4_ch5.TABLE_9,
        10: content_ch4_ch5.TABLE_10,
        11: content_ch4_ch5.TABLE_11,
        12: content_ch4_ch5.TABLE_12,
        13: content_ch6_ch8.TABLE_13,
        14: content_ch6_ch8.TABLE_14,
        15: content_ch6_ch8.TABLE_15,
        16: content_ch6_ch8.TABLE_16,
        17: content_ch6_ch8.TABLE_17,
        18: content_ch6_ch8.TABLE_18,
        19: content_ch6_ch8.TABLE_19,
    }

    # Update paragraphs
    print(f"Updating {len(all_paras)} paragraphs...")
    para_updated_count = 0
    for p_idx, text in all_paras.items():
        if p_idx < len(doc.paragraphs):
            update_paragraph(doc.paragraphs[p_idx], text)
            para_updated_count += 1
        else:
            print(f"Warning: paragraph index {p_idx} out of range!")
    print(f"Successfully updated {para_updated_count} paragraphs.")

    # Update tables
    print(f"Updating {len(all_tables)} tables...")
    for t_idx, table_data in all_tables.items():
        if t_idx < len(doc.tables):
            doc_table = doc.tables[t_idx]
            for r_idx, row_data in enumerate(table_data):
                if r_idx < len(doc_table.rows):
                    row = doc_table.rows[r_idx]
                    for c_idx, cell_value in enumerate(row_data):
                        if c_idx < len(row.cells):
                            update_cell(row.cells[c_idx], str(cell_value))
        else:
            print(f"Warning: table index {t_idx} out of range!")
    print("Successfully updated all 20 tables.")

    # Save to local workspace
    print(f"Saving to {OUTPUT_LOCAL}...")
    doc.save(OUTPUT_LOCAL)
    file_size = os.path.getsize(OUTPUT_LOCAL)
    print(f"Saved locally: {OUTPUT_LOCAL} ({file_size / 1024:.1f} KB)")

    # Copy to user's Downloads folder
    try:
        shutil.copyfile(OUTPUT_LOCAL, OUTPUT_DOWNLOADS)
        print(f"Copied to user Downloads: {OUTPUT_DOWNLOADS}")
    except Exception as e:
        print(f"Could not copy to {OUTPUT_DOWNLOADS}: {e}")

    try:
        shutil.copyfile(OUTPUT_LOCAL, ALT_DOWNLOADS)
        print(f"Copied to alternative Downloads: {ALT_DOWNLOADS}")
    except Exception as e:
        print(f"Note: {ALT_DOWNLOADS} was locked or in use (skipping alternative copy).")

if __name__ == "__main__":
    main()
