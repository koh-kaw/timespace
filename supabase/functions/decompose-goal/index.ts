const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { title, target_value, unit, target_date, strategy_type } = body;

    const parts = [`目標: ${title}`];
    if (target_value) parts.push(`目標値: ${Number(target_value).toLocaleString()} ${unit || ''}`);
    if (target_date) parts.push(`期限: ${target_date}`);
    if (strategy_type) parts.push(`カテゴリ: ${strategy_type}`);

    const userPrompt = parts.join('\n') +
      '\n\nこの目標を10年→1年→1ヶ月→1週間→今日の具体的アクションまで逆算で分解してください。';

    const systemPrompt = `あなたは目標達成の専門家です。ユーザーの目標を受け取り、それを階層的に分解してください。必ずJSON形式のみで返してください。前置きや説明は不要です。
フォーマット:
{
  "subgoals": [
    {
      "title": "サブ目標名",
      "target_value": 数値またはnull,
      "unit": "単位またはnull",
      "horizon": "10年/1年/6ヶ月/1ヶ月/1週間/今日",
      "strategy": "savings/habit/skill/revenue/custom",
      "children": []
    }
  ],
  "today_action": "今日すぐできる具体的な一歩（1行）"
}`;

    // Try Groq first
    const groqKey = Deno.env.get('GROQ_API_KEY') ?? '';
    
    if (!groqKey) {
      throw new Error('GROQ_API_KEY が設定されていません');
    }

    console.log('Calling Groq API...');
    
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2048,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    console.log('Groq status:', groqRes.status);
    
    const groqText = await groqRes.text();
    console.log('Groq response (first 200):', groqText.slice(0, 200));

    if (!groqRes.ok) {
      throw new Error(`Groq error ${groqRes.status}: ${groqText.slice(0, 200)}`);
    }

    const groqData = JSON.parse(groqText);
    if (groqData.error) throw new Error(JSON.stringify(groqData.error));

    const content = groqData.choices?.[0]?.message?.content ?? '';
    console.log('Content (first 200):', content.slice(0, 200));

    // Parse JSON from response
    let result: any;
    try {
      result = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSONが見つかりません: ' + content.slice(0, 200));
      result = JSON.parse(jsonMatch[0]);
    }

    if (!result.subgoals || !Array.isArray(result.subgoals)) {
      throw new Error('不正なレスポンス形式: ' + JSON.stringify(result).slice(0, 200));
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Error:', String(err));
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
