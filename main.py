from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
from recipe_book.recipe_book import search_ingredients, generate_recipe

app = FastAPI(title="Recipe Generator API",
              description="API for generating recipes based on nutritional requirements")

# Enable CORS - Update with your frontend URL in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    recipe_params: Optional[Dict[str, Any]] = None
    ingredients: Optional[List[Dict[str, Any]]] = None

class ChatResponse(BaseModel):
    response: str
    recipe: Optional[Dict[str, Any]] = None
    needs_recipe_params: bool = False
    ingredients: Optional[List[Dict[str, Any]]] = None

class RecipeParams(BaseModel):
    protein: int
    carbs: int
    fat: int
    diet: str
    cuisine: str
    avoid: List[str]

class SearchIngredientsRequest(BaseModel):
    protein: int
    carbs: int
    fat: int
    diet: str
    avoid: List[str]

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/")
async def root():
    return {"message": "Recipe Assistant API is running"}

@app.post("/api/search-ingredients", response_model=Dict[str, Any])
async def search_ingredients_endpoint(request: SearchIngredientsRequest):
    try:
        # Convert request to format expected by recipe_book
        user_input = {
            "protein": request.protein,
            "carbs": request.carbs,
            "fat": request.fat,
            "diet": request.diet,
            "avoid": request.avoid
        }
        
        # Get matching ingredients
        ingredients = search_ingredients(user_input)
        
        # Format ingredients for response
        formatted_ingredients = []
        for ing in ingredients:
            formatted_ingredients.append({
                "name": ing.get("name", ""),
                "protein": ing.get("protein", 0),
                "carbs": ing.get("carbs", 0),
                "fat": ing.get("fat", 0),
                "calories": ing.get("calories", 0)
            })
        
        return {
            "status": "success",
            "count": len(formatted_ingredients),
            "ingredients": formatted_ingredients
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching ingredients: {str(e)}")

@app.post("/api/chat", response_model=ChatResponse)
async def chat(chat_request: ChatRequest):
    try:
        user_message = chat_request.message.lower()
        
        # Check if we need recipe parameters (only if we don't already have them)
        if ("recipe" in user_message or "cook" in user_message or "make" in user_message) and not chat_request.recipe_params:
            return {
                "response": "I can help you generate a recipe! Please provide the following details:",
                "needs_recipe_params": True
            }
        
        # If we have recipe parameters and ingredients, generate a recipe
        if chat_request.recipe_params and chat_request.ingredients:
            try:
                # Generate recipe using the provided ingredients and user preferences
                recipe_text = generate_recipe(chat_request.ingredients, chat_request.recipe_params)
                
                # Ensure recipe is a dictionary with a 'content' key
                recipe = {
                    "content": recipe_text if isinstance(recipe_text, str) else str(recipe_text),
                    "title": "Generated Recipe",
                    "ingredients": chat_request.ingredients
                }
                
                return {
                    "response": "Here's a recipe based on your preferences:",
                    "recipe": recipe,
                    "needs_recipe_params": False
                }
            except Exception as e:
                error_msg = str(e)
                return {
                    "response": f"Sorry, I encountered an error generating your recipe: {error_msg}",
                    "recipe": {
                        "content": f"Error: {error_msg}",
                        "title": "Recipe Generation Error"
                    },
                    "needs_recipe_params": False
                }
        
        # Default responses
        if "hello" in user_message or "hi" in user_message:
            response = "Hello! I'm your recipe assistant. What would you like to cook today?"
        elif "thank" in user_message:
            response = "You're welcome! Is there anything else I can help you with?"
        else:
            response = "I'm a recipe assistant. You can ask me to help you find or create recipes based on your dietary needs."
        
        return {
            "response": response,
            "needs_recipe_params": False
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)