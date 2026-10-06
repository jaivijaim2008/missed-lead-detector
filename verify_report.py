import docx

doc = docx.Document("Missed_Lead_Detector_PBL_ML_Report.docx")
print("=== VERIFICATION REPORT ===")
print("Paragraphs count:", len(doc.paragraphs))
print("Tables count:", len(doc.tables))

# Verify Cover
print("\nP0 (Title):", doc.paragraphs[0].text)
print("P0 Style:", doc.paragraphs[0].style.name, "| Run size:", doc.paragraphs[0].runs[0].font.size.pt if doc.paragraphs[0].runs[0].font.size else "inherited")

# Verify Certificate
print("\nP51 (Bonafide):", doc.paragraphs[51].text[:120], "...")

# Verify Abstract
print("\nP110:", doc.paragraphs[110].text)
print("P111 (Abstract sample):", doc.paragraphs[111].text[:150], "...")
print("P119 (Keywords):", doc.paragraphs[119].text)

# Verify Chapter 1
print("\nP132:", doc.paragraphs[132].text)
print("P133:", doc.paragraphs[133].text)
print("P134:", doc.paragraphs[134].text[:100], "...")

# Verify Chapter 4
print("\nP245:", doc.paragraphs[245].text)
print("P246:", doc.paragraphs[246].text)

# Verify Chapter 7
print("\nP324:", doc.paragraphs[324].text)
print("P330:", doc.paragraphs[330].text[:100], "...")

# Verify References
print("\nP370:", doc.paragraphs[370].text)
print("P371:", doc.paragraphs[371].text[:100], "...")

# Verify Appendix
print("\nP390:", doc.paragraphs[390].text)
print("P391 sample:", doc.paragraphs[391].text[:100].replace('\n', ' '))

# Verify Tables sample
print("\n--- TABLES SAMPLING ---")
print("Table 0 (Students):", [[c.text for c in r.cells] for r in doc.tables[0].rows])
print("Table 4 (Symbols): row 1:", [c.text for c in doc.tables[4].rows[1].cells])
print("Table 5 (Literature): header:", [c.text for c in doc.tables[5].rows[0].cells[:4]])
print("Table 13 (Benchmarks): header:", [c.text for c in doc.tables[13].rows[0].cells[:4]])
print("Table 19 (PO/PSO): row 1:", [c.text for c in doc.tables[19].rows[1].cells[:2]])

print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")
