def reference_search_keyword_prompt(input: str):
    """
    Builds a minimal, structured prompt for generating a precise Google Scholar search keyword or phrase
    based on a given problem statement/title.
    """

    contents = []

    # === ROLE & INSTRUCTION ===
    contents.append(
        {
            "role": "system",
            "parts": (
                "You are a precise and minimal **keyword generator** that creates search phrases "
                "suitable for use in **Google Scholar** queries.\n\n"
                "Your goal is to extract or infer the most relevant and concise **academic search phrase** "
                "based on the given problem statement/title.\n"
                "Focus on the **core technical concept** — such as the model, method, framework, or research focus — "
                "that would yield meaningful academic results.\n\n"
                "You must output **only the keyword or phrase** in the correct json format, with no additional text, no punctuation, and no special formatting."
            ),
        }
    )

    # === EXAMPLES ===
    contents.append(
        {
            "role": "system",
            "parts": (
                "### Example Outputs\n"
                "1. self-supervised dialog emotion\n"
                "2. multilingual LLM\n"
                "3. LLM FCAPS correlation\n"
                "4. deep packet inspection\n"
                "5. anti-aliasing\n"
                "6. LLM for code generation and debugging\n"
            ),
        }
    )

    # === USER INPUT ===
    contents.append(
        {
            "role": "user",
            "parts": (
                f"Generate the most suitable Google Scholar search keyword or phrase for this problem statement/title:\n"
                f"'{input}'\n\n"
            ),
        }
    )

    return contents
