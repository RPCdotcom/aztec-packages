#include "barretenberg/vm2/tracegen_helper.hpp"

#include <array>
#include <functional>
#include <list>
#include <span>

#include "barretenberg/common/std_array.hpp"
#include "barretenberg/common/thread.hpp"
#include "barretenberg/numeric/bitop/get_msb.hpp"
#include "barretenberg/vm/stats.hpp"
#include "barretenberg/vm2/tracegen/alu_trace.hpp"
#include "barretenberg/vm2/tracegen/execution_trace.hpp"
#include "barretenberg/vm2/tracegen/precomputed_trace.hpp"
#include "barretenberg/vm2/tracegen/trace_container.hpp"

namespace bb::avm2 {

using namespace bb::avm2::simulation;
using namespace bb::avm2::tracegen;

namespace {

auto build_precomputed_columns_jobs(TraceContainer& trace)
{
    return std::array<std::function<void()>, 2>{
        [&]() {
            PrecomputedTraceBuilder precomputed_builder;
            AVM_TRACK_TIME("tracegen/precomputed/misc", precomputed_builder.process_misc(trace));
        },
        [&]() {
            PrecomputedTraceBuilder precomputed_builder;
            AVM_TRACK_TIME("tracegen/precomputed/bitwise", precomputed_builder.process_bitwise(trace));
        },
    };
}

void execute_jobs(std::span<std::function<void()>> jobs)
{
    parallel_for(jobs.size(), [&](size_t i) { jobs[i](); });
}

} // namespace

TraceContainer AvmTraceGenHelper::generate_trace(EventsContainer&& events)
{
    TraceContainer trace;
    // We process the events in parallel. Ideally the jobs should access disjoint column sets.
    auto jobs = concatenate(
        // Precomputed column jobs.
        build_precomputed_columns_jobs(trace),
        // Subtrace jobs.
        std::array<std::function<void()>, 2>{
            [&]() {
                ExecutionTraceBuilder exec_builder;
                AVM_TRACK_TIME("tracegen/execution", exec_builder.process(events.execution, events.addressing, trace));
                events.execution.clear();
                events.addressing.clear();
            },
            [&]() {
                AluTraceBuilder alu_builder;
                AVM_TRACK_TIME("tracegen/alu", alu_builder.process(events.alu, trace));
                events.alu.clear();
            },
        });
    execute_jobs(jobs);

    const auto rows = trace.get_num_rows();
    info("Generated trace with ",
         rows,
         " rows (closest power of 2: ",
         numeric::get_msb(numeric::round_up_power_2(rows)),
         ")");
    return trace;
}

TraceContainer AvmTraceGenHelper::generate_precomputed_columns()
{
    TraceContainer trace;
    auto jobs = build_precomputed_columns_jobs(trace);
    execute_jobs(jobs);
    return trace;
}

} // namespace bb::avm2