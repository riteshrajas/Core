# Simple Flask app to display information about global warming
# To run:
#   pip install flask
#   python app.py
# Then visit http://127.0.0.1:5000/

from flask import Flask, render_template_string

app = Flask(__name__)

# Minimal HTML content about global warming
CONTENT = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Global Warming Awareness</title>
    <style>
      body {font-family: Arial, sans-serif; margin: 2rem; background: #f9f9f9;}
      h1 {color: #d32f2f;}
      p {line-height: 1.5;}
    </style>
  </head>
  <body>
    <h1>Global Warming</h1>
    <p>Global warming refers to the long‑term rise in Earth’s average surface temperature.</p>
    <p>It is driven primarily by increased concentrations of greenhouse gases such as CO₂, methane, and nitrous oxide.</p>
    <p>Consequences include rising sea levels, more extreme weather events, and disruptions to ecosystems.</p>
    <p>Mitigation actions involve reducing fossil‑fuel use, transitioning to renewable energy, and protecting forested areas.</p>
  </body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(CONTENT)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=True)
