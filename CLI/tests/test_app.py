import sys
import types

from src.app import main

def test_main(capsys):
    # Capture output
    main.main()
    captured = capsys.readouterr()
    assert "Hello, World!" in captured.out
