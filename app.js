import express from "express";
import bodyParser from "body-parser";
import { Octokit } from "@octokit/rest";
import { Configuration, OpenAIApi } from "openai";
import * as dotenv from "dotenv";

dotenv.config();

// Create an instance of the Express app
const app = express();

// Specify the port
const port = 3000;

// Configure body-parser for Express app
app.use(bodyParser.json());

// Create an instance of the Octokit REST client
const octokit = new Octokit({
    auth: process.env.GITHUB_ACCESS_TOKEN,
});

const configuration = new Configuration({
  apiKey:process.env.OPENAI_API_KEY
});

const openai = new OpenAIApi(configuration);

// PR review by openai
const prReviewByOpenai = async(codediff)=>{
    const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: `Review the pull request ${codediff}`,
        temperature: 0.7,
        max_tokens: 64,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
    });
    return response.data.choices[0].text;
}

// Create a webhook route for GitHub
app.post("/webhook", async(req, res) => {

  // Parse the payload
  const payload = req.body;

  // Check if this is a pull request event
  if (payload.action === "opened") {

    // Extract the necessary details from the payload
    const { number: pr_number, repository: { full_name: repo_full_name } } = payload;

    // Get the pull request details using Octokit
    const pullRequest = await octokit.rest.pulls.get({
      owner: repo_full_name.split('/')[0],
      repo: repo_full_name.split('/')[1],
      pull_number: pr_number,
    });

    // Create a code review on the pull request using Octokit
    const review = await octokit.rest.pulls.createReview({
      owner: pullRequest.data.head.repo.owner.login,
      repo: repo_full_name.split('/')[1],
      pull_number: pr_number,
      body: await prReviewByOpenai(pullRequest.data.diff_url),
      event: 'APPROVE'
    });
    
    console.log('Code review created:', review.data.html_url);
  }
  // Send a response to GitHub
  res.status(200).send("Success");
});

// Start the server
app.listen(port, () => {
  console.log(`Webhook server started on http://localhost:${port}`);
});
