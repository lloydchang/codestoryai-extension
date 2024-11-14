import * as React from "react";
import { Event, ViewType, Task, View } from "../model";
import { TaskView } from "@task/view";
import { mockTask } from "mock/task";
import { PresetView } from "@preset/view";

interface vscode {
  postMessage(message: Event): void;
}

declare const vscode: vscode;

function onNewRequest(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const query = data.get("query");
  if (query && typeof query === "string") {
    vscode.postMessage({ type: "init" });
  }
}

function onNewPreset(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  console.log(Object.fromEntries(data))
}

// Move this somewhere else
interface State {
  extensionReady: boolean;
  view: ViewType;
  currentTask?: Task;
  loadedTasks: Map<string, Task>;
}

const mockLoadedTasks = new Map();
mockLoadedTasks.set(mockTask.sessionId, mockTask);

const initialState: State = {
  extensionReady: false,
  view: View.Task,
  currentTask: mockTask,
  loadedTasks: mockLoadedTasks, // new Map(),
};

function reducer(state: State, action: Event) {
  const newState = structuredClone(state);
  if (action.type === "init") {
    newState.extensionReady = true;
  } else if (action.type === "open-task") {
    const task = action.task;
    if (!newState.loadedTasks.has(task.sessionId)) {
      newState.loadedTasks.set(task.sessionId, task);
    }
    newState.view = View.Task;
    newState.currentTask = task;
  }
  return newState;
}

const App = () => {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const [isSidecarReady, setIsSidecarReady] = React.useState(false);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent<Event>) => {
      dispatch(event.data);
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  React.useEffect(() => {
    // handles messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      // Only PanelProvider sends updateState messages
      if (message.command === 'updateState') {
        setIsSidecarReady(message.isSidecarReady);
      }
    };

    // listen for messages
    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  // loading spinner
  if (!isSidecarReady) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="text-sm text-gray-600">Downloading and starting Sota PR Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {renderView(state)}
    </div>
  );
}

function renderView(state: State) {
  switch (state.view) {
    case View.Task:
      if (!state.currentTask) {
        return "Error"; // Implement better fallback
      }
      return <TaskView task={state.currentTask} onSubmit={onNewRequest} />;
    case View.Preset:
      return <PresetView onSubmit={onNewPreset} />
    default:
      return "View not implemented";
  }
}

export default App;
