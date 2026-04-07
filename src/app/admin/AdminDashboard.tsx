"use client";

import { useState } from "react";

interface User {
  id: string;
  email: string;
  credits: number;
  createdAt: string;
}

interface Purchase {
  id: string;
  userId: string;
  creditsAdded: number;
  amountPaid: number;
  createdAt: string;
}

interface UsageEvent {
  id: string;
  userId: string;
  feature: string;
  statusCode: number;
  durationMs: number;
  createdAt: string;
}

interface LlmUsage {
  id: string;
  provider: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsdMicros: number;
  createdAt: string;
}

interface AuditLog {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action: string;
  targetUserId: string;
  targetEmail: string;
  detail: string;
  createdAt: string;
}

interface Stats {
  totalRevenue: number;
  totalLlmCost: number;
  grossMargin: string;
  totalAnalyses: number;
}

interface Props {
  users: User[];
  purchases: Purchase[];
  usageEvents: UsageEvent[];
  llmUsage: LlmUsage[];
  auditLogs: AuditLog[];
  stats: Stats;
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

const TABS = ["Overview", "Usage & Costs", "User Management", "Audit Log"];

export default function AdminDashboard({
  users,
  purchases,
  usageEvents,
  llmUsage,
  auditLogs,
  stats,
}: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState<number>(0);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  const handleSaveCredits = async (user: User) => {
    const res = await fetch("/api/admin/users/credits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, credits: editCredits }),
    });
    if (res.ok) {
      setSaveSuccess(user.id);
      setEditingUser(null);
      setTimeout(() => setSaveSuccess(null), 3000);
    }
  };

  const featureGroups = usageEvents.reduce(
    (acc, e) => {
      if (!acc[e.feature]) acc[e.feature] = { count: 0, totalMs: 0, success: 0 };
      acc[e.feature].count++;
      acc[e.feature].totalMs += e.durationMs;
      if (e.statusCode === 200) acc[e.feature].success++;
      return acc;
    },
    {} as Record<string, { count: number; totalMs: number; success: number }>
  );

  const llmGroups = llmUsage.reduce(
    (acc, l) => {
      const key = `${l.provider}/${l.model}/${l.operation}`;
      if (!acc[key]) {
        acc[key] = {
          provider: l.provider,
          model: l.model,
          operation: l.operation,
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsdMicros: 0,
        };
      }
      acc[key].calls++;
      acc[key].inputTokens += l.inputTokens;
      acc[key].outputTokens += l.outputTokens;
      acc[key].costUsdMicros += l.costUsdMicros;
      return acc;
    },
    {} as Record<
      string,
      {
        provider: string;
        model: string;
        operation: string;
        calls: number;
        inputTokens: number;
        outputTokens: number;
        costUsdMicros: number;
      }
    >
  );

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        🛡 Admin Dashboard
      </h1>

      <div className="flex gap-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === i ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1 — Overview */}
      {activeTab === 0 && (
        <div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white border rounded-xl p-5">
              <div className="text-xs font-medium text-green-600 uppercase mb-1">Total Revenue</div>
              <div className="text-2xl font-bold">${(stats.totalRevenue / 100).toFixed(2)}</div>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <div className="text-xs font-medium text-red-600 uppercase mb-1">LLM Cost</div>
              <div className="text-2xl font-bold">
                ${(stats.totalLlmCost / 1_000_000).toFixed(4)}
              </div>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <div className="text-xs font-medium text-blue-600 uppercase mb-1">Gross Margin</div>
              <div className="text-2xl font-bold">{stats.grossMargin}%</div>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">
                Total Analyses
              </div>
              <div className="text-2xl font-bold">{stats.totalAnalyses}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b font-medium">Revenue by Pack</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-500">Pack</th>
                    <th className="text-right px-4 py-2 text-gray-500">Sales</th>
                    <th className="text-right px-4 py-2 text-gray-500">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {[10, 20].map((credits) => {
                    const packs = purchases.filter((p) => p.creditsAdded === credits);
                    const rev = packs.reduce((s, p) => s + p.amountPaid, 0);
                    return (
                      <tr key={credits} className="border-t">
                        <td className="px-4 py-2">{credits === 10 ? "Starter" : "Pro"}</td>
                        <td className="px-4 py-2 text-right">{packs.length}</td>
                        <td className="px-4 py-2 text-right">${(rev / 100).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b font-medium">LLM Cost by Model</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-500">Model</th>
                    <th className="text-right px-4 py-2 text-gray-500">Calls</th>
                    <th className="text-right px-4 py-2 text-gray-500">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(llmGroups).map((g) => (
                    <tr key={`${g.model}-${g.operation}`} className="border-t">
                      <td className="px-4 py-2">{g.model}</td>
                      <td className="px-4 py-2 text-right">{g.calls}</td>
                      <td className="px-4 py-2 text-right">
                        ${(g.costUsdMicros / 1_000_000).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2 — Usage & Costs */}
      {activeTab === 1 && (
        <div className="space-y-6">
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b font-medium">Feature Usage</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500">Feature</th>
                  <th className="text-right px-4 py-2 text-gray-500">Calls</th>
                  <th className="text-right px-4 py-2 text-gray-500">Avg Latency</th>
                  <th className="text-right px-4 py-2 text-gray-500">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(featureGroups).map(([feature, g]) => (
                  <tr key={feature} className="border-t">
                    <td className="px-4 py-2">{feature}</td>
                    <td className="px-4 py-2 text-right">{g.count}</td>
                    <td className="px-4 py-2 text-right">
                      {g.count > 0 ? Math.round(g.totalMs / g.count) : 0}ms
                    </td>
                    <td className="px-4 py-2 text-right">
                      {g.count > 0 ? ((g.success / g.count) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b font-medium">LLM Token & Cost Detail</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500">Provider/Model</th>
                  <th className="text-left px-4 py-2 text-gray-500">Operation</th>
                  <th className="text-right px-4 py-2 text-gray-500">Calls</th>
                  <th className="text-right px-4 py-2 text-gray-500">Input Tokens</th>
                  <th className="text-right px-4 py-2 text-gray-500">Output Tokens</th>
                  <th className="text-right px-4 py-2 text-gray-500">Cost (USD)</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(llmGroups).map((g) => (
                  <tr key={`${g.model}-${g.operation}`} className="border-t">
                    <td className="px-4 py-2">
                      {g.provider}/{g.model}
                    </td>
                    <td className="px-4 py-2">{g.operation}</td>
                    <td className="px-4 py-2 text-right">{g.calls}</td>
                    <td className="px-4 py-2 text-right">
                      {g.inputTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {g.outputTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      ${(g.costUsdMicros / 1_000_000).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3 — User Management */}
      {activeTab === 2 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="font-medium">Users ({users.length})</span>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search by email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button className="border rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                Export CSV
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-gray-500">Email</th>
                <th className="text-right px-4 py-2 text-gray-500">Credits</th>
                <th className="text-center px-4 py-2 text-gray-500">Tier</th>
                <th className="text-left px-4 py-2 text-gray-500">Joined</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <>
                  <tr key={user.id} className="border-t">
                    <td className="px-4 py-2">{user.email}</td>
                    <td className="px-4 py-2 text-right">
                      {saveSuccess === user.id ? (
                        <span className="text-green-600 font-medium">✓ Saved</span>
                      ) : (
                        user.credits
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          user.credits > 0
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {user.credits > 0 ? "Paid" : "Free"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => {
                          setEditingUser(user.id);
                          setEditCredits(user.credits);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit Credits
                      </button>
                    </td>
                  </tr>
                  {editingUser === user.id && (
                    <tr className="bg-blue-50 border-t">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">New credit balance:</span>
                          <input
                            type="number"
                            min="0"
                            value={editCredits}
                            onChange={(e) => setEditCredits(Number(e.target.value))}
                            className="border rounded px-2 py-1 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => handleSaveCredits(user)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700"
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="text-gray-500 hover:text-gray-700 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4 — Audit Log */}
      {activeTab === 3 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="font-medium">Audit Log ({auditLogs.length})</span>
            <button className="border rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              Export Log
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-gray-500">Timestamp</th>
                <th className="text-left px-4 py-2 text-gray-500">Admin</th>
                <th className="text-center px-4 py-2 text-gray-500">Action</th>
                <th className="text-left px-4 py-2 text-gray-500">Target User</th>
                <th className="text-left px-4 py-2 text-gray-500">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-2">{log.adminEmail}</td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        log.action === "Credit Update"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2">{log.targetEmail}</td>
                  <td className="px-4 py-2 text-gray-500">{log.detail}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No audit log entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
