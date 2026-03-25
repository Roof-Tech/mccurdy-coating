#!/usr/bin/env python3
"""
Roof transformation AI image generator.
Takes a before photo and generates an after image showing silicone coating applied.

Usage:
  python transform-roof.py <input_image_path> <color> <output_path>
  
  color: "white" or "gray"
"""
import sys
import asyncio
import base64
from pathlib import Path

from pplx.python.sdks.llm_api import (
    Client,
    Conversation,
    Identity,
    ImageBlock,
    ImageGenAspectRatio,
    ImageGenParams,
    ImageSource,
    ImageSourceType,
    LLMAPIClient,
    MediaGenParams,
    SamplingParams,
    TextBlock,
)


PROMPTS = {
    "white": (
        "Transform this roof photo to show a completed bright white silicone roof coating restoration. "
        "The roof surface should look freshly coated with a smooth, clean, bright white silicone membrane. "
        "All cracks, stains, ponding water marks, and deterioration should be gone — replaced by a pristine, "
        "uniform white reflective coating. Seams, flashings, and penetrations should look professionally sealed "
        "with smooth white silicone. The surrounding building structure, HVAC units, and environment should remain "
        "identical — only the roof surface changes to gleaming white silicone. Make it look photorealistic, "
        "as if a professional crew just finished coating. The white coating should have a subtle sheen showing "
        "it is a fresh silicone application."
    ),
    "gray": (
        "Transform this roof photo to show a completed gray silicone roof coating restoration. "
        "The roof surface should look freshly coated with a smooth, clean, medium gray silicone membrane. "
        "All cracks, stains, ponding water marks, and deterioration should be gone — replaced by a pristine, "
        "uniform gray reflective coating. Seams, flashings, and penetrations should look professionally sealed "
        "with smooth gray silicone. The surrounding building structure, HVAC units, and environment should remain "
        "identical — only the roof surface changes to a professional gray silicone finish. Make it look photorealistic, "
        "as if a professional crew just finished coating. The gray coating should have a subtle sheen showing "
        "it is a fresh silicone application."
    ),
}


async def transform_roof(input_path: str, color: str, output_path: str):
    img_bytes = Path(input_path).read_bytes()
    
    # Detect media type
    ext = Path(input_path).suffix.lower()
    media_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}
    media_type = media_types.get(ext, "image/jpeg")
    
    prompt = PROMPTS.get(color, PROMPTS["white"])
    
    client = LLMAPIClient()
    convo = Conversation()
    
    b64 = base64.b64encode(img_bytes).decode()
    content = [
        ImageBlock(
            source=ImageSource(
                type=ImageSourceType.BASE64,
                media_type=media_type,
                data=b64,
            )
        ),
        TextBlock(text=prompt),
    ]
    convo.add_user(content)
    
    result = await client.messages.create(
        model="nano_banana_pro",
        convo=convo,
        identity=Identity(client=Client.ASI, use_case="webserver_image_gen"),
        sampling_params=SamplingParams(max_tokens=1),
        media_gen_params=MediaGenParams(
            image=ImageGenParams(
                number_of_images=1,
                aspect_ratio=ImageGenAspectRatio.RATIO_4_3,
            ),
        ),
    )
    
    if not result.images:
        print("ERROR: No image generated", file=sys.stderr)
        sys.exit(1)
    
    out_bytes = base64.b64decode(result.images[0].b64_data)
    Path(output_path).write_bytes(out_bytes)
    print(f"OK:{output_path}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: transform-roof.py <input_path> <color> <output_path>", file=sys.stderr)
        sys.exit(1)
    
    input_path, color, output_path = sys.argv[1], sys.argv[2], sys.argv[3]
    asyncio.run(transform_roof(input_path, color, output_path))
