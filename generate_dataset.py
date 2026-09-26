import csv
import os
import random
from collections import Counter

random.seed(42)

def generate_dataset(num_samples=1000):
    """Generate a synthetic dataset for the missed lead detection model."""
    
    # Label distribution: lead (40%), spam (30%), general (30%)
    labels = {
        'lead': 400,
        'spam': 300,
        'general': 300
    }
    
    # Intent mapping based on label
    intents = {
        'lead': ['pricing', 'meeting', 'partnership', 'product_inquiry'],
        'spam': ['promotion', 'offer', 'winner'],
        'general': ['info', 'update', 'document']
    }
    
    # Priority distribution: HIGH (40%), MEDIUM (40%), LOW (20%)
    priorities = {
        'lead': [1, 1, 1],  # Equal probability for HIGH, MEDIUM, LOW
        'spam': [0, 1, 2],  # LOW, MEDIUM, HIGH
        'general': [0, 1, 2]  # LOW, MEDIUM, HIGH
    }
    
    # Sample templates for different types
    templates = {
        'lead': [
            "I am interested in your enterprise software. Could you send me the pricing details?",
            "Hello, we are interested in your AI solution. Please share your pricing structure.",
            "Could you provide more information about your products?",
            "I would like to learn more about your business solution.",
            "Our company is currently looking for your software. We are planning to purchase this for our company.",
            "I am interested in your subscription plan. We are interested in buying the solution.",
            "Please send me the product specifications and available plans.",
            "I would like to discuss a partnership opportunity with your company.",
            "Could we schedule a demo to see your platform?",
            "We are interested in your AI solution. Could you send a price estimate?"
        ],
        'spam': [
            "Congratulations! You have been selected to receive a cash reward. Claim now!",
            "You have won a free gift. Click here immediately to collect it.",
            "Urgent! Your account has won a $5000 prize. Send your details now.",
            "Limited time offer - act fast to get your discount!",
            "This is a phishing attempt. Verify your account immediately.",
            "Your invoice is due. Pay now to avoid suspension.",
            "Win a free product! Enter now for a chance to win.",
            "Your password has been compromised. Change it today."
        ],
        'general': [
            "The project is progressing as planned.",
            "Meeting has been moved to Monday.",
            "I will get back to you shortly.",
            "Please review the attached document.",
            "Thank you for the update.",
            "The meeting has been rescheduled.",
            "I received the document you sent.",
            "Could you please clarify the timeline?"
        ]
    }
    
    # Generate samples
    generated_data = []
    
    for i in range(num_samples):
        # Choose label
        label = random.choices(list(labels.keys()), weights=[labels['lead'], labels['spam'], labels['general']], k=1)[0]
        
        # Choose intent based on label
        intent_list = intents[label]
        intent = random.choice(intent_list)
        
        # Choose priority
        priority_idx = random.choices(range(len(priorities[label])), weights=[priorities[label][0], priorities[label][1], priorities[label][2]], k=1)[0]
        priority_map = {0: 'LOW', 1: 'MEDIUM', 2: 'HIGH'}
        priority = priority_map[priority_idx]
        
        # Get template
        template = random.choice(templates[label])
        
        # Generate text with some variation
        text = template
        if random.random() > 0.7:
            text = f"{text} - "
        
        # Create row
        row = {
            'id': i + 1,
            'sender': f"user{i % 100}",
            'subject': text[:200],
            'body': text[:500],
            'label': label,
            'intent': intent,
            'priority': priority
        }
        generated_data.append(row)
    
    # Sort by label for consistent output
    generated_data.sort(key=lambda x: x['label'])
    
    # Write to CSV
    output_path = "dataset/generated_emails.csv"
    fieldnames = ['id', 'sender', 'subject', 'body', 'label', 'intent', 'priority']
    
    with open(output_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(generated_data)
    
    print(f"Generated {len(generated_data)} samples in {output_path}")
    print("\nLabel Distribution:")
    for label, count in sorted(labels.items()):
        print(f"  {label}: {count}")
    print("\nIntent Distribution:")
    for label, intent_list in sorted(intents.items()):
        print(f"  {label}: {intent_list}")
    print("\nPriority Distribution:")
    for label, prio_weights in sorted(priorities.items()):
        print(f"  {label}: weights={prio_weights}")

if __name__ == "__main__":
    generate_dataset(1000)