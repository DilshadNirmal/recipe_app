import axios from "axios";
import { useState } from "react";
import { FaPaperPlane, FaUtensils } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([
    {
      text: "Hello! I'm your recipe assistant. What would you like to cook today?",
      user: false,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    protein: "",
    carbs: "",
    fat: "",
    diet: "non-vegetarian",
    cuisine: "",
    avoid: "",
  });
  const [searchedIngredients, setSearchedIngredients] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSendMessage = async () => {
    if (input.trim()) {
      const newMessages = [...messages, { text: input, user: true }];
      setMessages(newMessages);
      setInput("");

      try {
        setLoading(true);
        const response = await axios.post(
          "http://localhost:8000/api/chat",
          {
            message: input,
            recipe_params: showRecipeForm
              ? {
                  protein: parseInt(recipeForm.protein) || 0,
                  carbs: parseInt(recipeForm.carbs) || 0,
                  fat: parseInt(recipeForm.fat) || 0,
                  diet: recipeForm.diet,
                  cuisine: recipeForm.cuisine,
                  avoid: recipeForm.avoid
                    ? recipeForm.avoid.split(",").map((item) => item.trim())
                    : [],
                }
              : null,
            ingredients: searchedIngredients,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );

        if (response.data) {
          if (response.data.needs_recipe_params) {
            setShowRecipeForm(true);
          } else if (response.data.recipe) {
            // Display the recipe
            setMessages((prev) => [
              ...prev,
              {
                text: response.data.response || "Here's your recipe:",
                user: false,
              },
              {
                text:
                  typeof response.data.recipe === "string"
                    ? response.data.recipe
                    : JSON.stringify(response.data.recipe, null, 2),
                user: false,
                isRecipe: true,
              },
            ]);
          } else if (response.data.response) {
            // Regular chat response
            setMessages((prev) => [
              ...prev,
              {
                text: response.data.response,
                user: false,
              },
            ]);
          }
        } else {
          throw new Error("Empty response from server");
        }
      } catch (error) {
        console.error("Error sending message:", error);
        const errorMessage =
          error.response?.data?.detail ||
          error.message ||
          "Could not connect to the server. Please try again later.";

        setMessages((prev) => [
          ...prev,
          {
            text: `Error: ${errorMessage}`,
            user: false,
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRecipeSubmit = async (e) => {
    e.preventDefault();
    setShowRecipeForm(false);
    setIsGenerating(true);

    // Clear any previous ingredients
    setSearchedIngredients([]);

    try {
      // First, get the ingredients
      const ingredientsResponse = await axios.post(
        "http://localhost:8000/api/search-ingredients",
        {
          protein: parseInt(recipeForm.protein) || 0,
          carbs: parseInt(recipeForm.carbs) || 0,
          fat: parseInt(recipeForm.fat) || 0,
          diet: recipeForm.diet,
          avoid: recipeForm.avoid
            ? recipeForm.avoid.split(",").map((item) => item.trim())
            : [],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      const ingredients = ingredientsResponse.data.ingredients || [];
      setSearchedIngredients(ingredients);

      // Show ingredients in chat
      setMessages((prev) => [
        ...prev,
        {
          text: `I'd like a recipe with:\nProtein: ${
            recipeForm.protein
          }g, Carbs: ${recipeForm.carbs}g, Fat: ${recipeForm.fat}g\nDiet: ${
            recipeForm.diet
          }, Cuisine: ${recipeForm.cuisine || "Any"}, Avoid: ${
            recipeForm.avoid || "None"
          }`,
          user: true,
        },
        {
          text: `Found ${ingredients.length} ingredients matching your criteria. Generating recipe...`,
          user: false,
        },
        {
          text: `**Selected Ingredients**:\n${ingredients
            .map(
              (i) => `- ${i.name} (${i.protein}gP, ${i.carbs}gC, ${i.fat}gF)`
            )
            .join("\n")}`,
          user: false,
          isIngredients: true,
        },
      ]);

      // Then generate the recipe
      const response = await axios.post(
        "http://localhost:8000/api/chat",
        {
          message: "Generate a recipe with these parameters",
          recipe_params: {
            protein: parseInt(recipeForm.protein) || 0,
            carbs: parseInt(recipeForm.carbs) || 0,
            fat: parseInt(recipeForm.fat) || 0,
            diet: recipeForm.diet,
            cuisine: recipeForm.cuisine,
            avoid: recipeForm.avoid
              ? recipeForm.avoid.split(",").map((item) => item.trim())
              : [],
          },
          ingredients: ingredients,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (response.data.recipe) {
        const recipe = response.data.recipe;
        setMessages((prev) => [
          ...prev,
          {
            text: response.data.response || "Here's your recipe:",
            user: false,
          },
          {
            text:
              typeof recipe === "string"
                ? recipe
                : recipe.content || JSON.stringify(recipe, null, 2),
            user: false,
            isRecipe: true,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            text: response.data.response || "No recipe could be generated.",
            user: false,
          },
        ]);
      }
    } catch (error) {
      console.error("Error generating recipe:", error);
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Error generating recipe. Please try again.";

      setMessages((prev) => [
        ...prev,
        {
          text: errorMessage,
          user: false,
        },
      ]);
    } finally {
      setIsGenerating(false);
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!showRecipeForm) {
        handleSendMessage();
      } else {
        handleRecipeSubmit(e);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setRecipeForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <h1 className="mb-8 font-bold text-4xl md:text-5xl drop-shadow-lg text-blue-300 text-center">
        <FaUtensils className="inline-block mr-2" /> Recipe Assistant
      </h1>

      <div
        className="bg-gray-800 w-full max-w-2xl shadow-xl rounded-lg overflow-hidden flex flex-col border border-gray-700"
        style={{ height: "80vh" }}
      >
        <div className="p-4 flex-1 overflow-y-auto bg-gray-900">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-4 ${msg.user ? "text-right" : "text-left"}`}
            >
              <div
                className={`inline-block p-3 rounded-lg max-w-[80%] ${
                  msg.user
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-700 text-gray-100 rounded-bl-none border border-gray-600"
                }`}
              >
                {msg.isRecipe ? (
                  <div className="whitespace-pre-wrap">
                    <h3 className="font-bold text-lg mb-2 text-blue-300">
                      🍳 Recipe
                    </h3>
                    <div className="bg-gray-800 p-3 rounded text-gray-100 border border-gray-700">
                      <ReactMarkdown className="prose prose-invert">
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : msg.isIngredients ? (
                  <div className="whitespace-pre-wrap">
                    <h3 className="font-bold text-md mb-1 text-green-300">
                      🧂 Selected Ingredients
                    </h3>
                    <div className="bg-gray-800 p-3 rounded text-gray-200 text-sm border border-gray-700">
                      <ReactMarkdown className="prose prose-invert">
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-invert">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="text-left mb-4">
              <div className="inline-block p-3 rounded-lg bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700">
                {isGenerating ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                    <span className="text-blue-300">
                      Generating your recipe...
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="animate-pulse flex space-x-1">
                      <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                      <div
                        className="h-2 w-2 bg-blue-400 rounded-full"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="h-2 w-2 bg-blue-400 rounded-full"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                    <span className="text-blue-300">Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {showRecipeForm && (
            <div className="bg-gray-800 p-4 rounded-lg mb-4 border border-gray-700">
              <h3 className="font-bold mb-3 text-gray-200">
                Recipe Preferences
              </h3>
              <form onSubmit={handleRecipeSubmit} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Protein (g)
                    </label>
                    <input
                      type="number"
                      name="protein"
                      value={recipeForm.protein}
                      onChange={handleInputChange}
                      className="w-full p-2 bg-gray-700 border-gray-600 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g. 100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Carbs (g)
                    </label>
                    <input
                      type="number"
                      name="carbs"
                      value={recipeForm.carbs}
                      onChange={handleInputChange}
                      className="w-full p-2 bg-gray-700 border-gray-600 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g. 200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Fat (g)
                    </label>
                    <input
                      type="number"
                      name="fat"
                      value={recipeForm.fat}
                      onChange={handleInputChange}
                      className="w-full p-2 bg-gray-700 border-gray-600 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g. 50"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Diet
                  </label>
                  <select
                    name="diet"
                    value={recipeForm.diet}
                    onChange={handleInputChange}
                    className="w-full p-2 bg-gray-700 border-gray-600 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="vegetarian" className="bg-gray-800">
                      Vegetarian
                    </option>
                    <option value="non-vegetarian" className="bg-gray-800">
                      Non-Vegetarian
                    </option>
                    <option value="vegan" className="bg-gray-800">
                      Vegan
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Cuisine (optional)
                  </label>
                  <input
                    type="text"
                    name="cuisine"
                    value={recipeForm.cuisine}
                    onChange={handleInputChange}
                    className="w-full p-2 bg-gray-700 border-gray-600 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Italian, Indian, Chinese"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Ingredients to avoid (comma separated, optional)
                  </label>
                  <input
                    type="text"
                    name="avoid"
                    value={recipeForm.avoid}
                    onChange={handleInputChange}
                    className="w-full p-2 bg-gray-700 border-gray-600 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., nuts, dairy, shellfish"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRecipeForm(false)}
                    className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Generate Recipe
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-800">
          {searchedIngredients.length > 0 && !isGenerating && (
            <div className="mb-3 p-3 bg-gray-700 rounded-lg border border-gray-600">
              <h4 className="text-sm font-medium text-blue-300 mb-2">
                Found {searchedIngredients.length} ingredients
              </h4>
              <div className="flex flex-wrap gap-2">
                {searchedIngredients.slice(0, 5).map((ing, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-gray-800 text-blue-100 px-2.5 py-1 rounded-full border border-gray-600 hover:bg-gray-700 transition-colors"
                    title={`Protein: ${ing.protein}g, Carbs: ${ing.carbs}g, Fat: ${ing.fat}g`}
                  >
                    {ing.name}
                  </span>
                ))}
                {searchedIngredients.length > 5 && (
                  <span className="text-xs text-gray-400 self-center">
                    +{searchedIngredients.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                showRecipeForm
                  ? "Press Enter to submit the form"
                  : "Type your message..."
              }
              className={`flex-1 p-3 bg-gray-700 border border-gray-600 rounded-l-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                loading || showRecipeForm ? "opacity-70 cursor-not-allowed" : ""
              }`}
              disabled={loading || showRecipeForm}
            />
            <button
              onClick={showRecipeForm ? handleRecipeSubmit : handleSendMessage}
              disabled={loading || (showRecipeForm ? false : !input.trim())}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-r-lg disabled:opacity-50 flex items-center justify-center transition-colors"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-auto w-5 border-2 border-white border-t-transparent"></div>
              ) : (
                <FaPaperPlane className="h-6 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
